# Dockerfile para aplicación IoT con reproducción de audio
# Flujo de audio:
#   1. Frontend graba audio y lo envía a vicevalds (https://app.vicevalds.dev/api/agent/process-audio)
#   2. Vicevalds procesa el audio y devuelve un audio de respuesta
#   3. Frontend descarga el audio de respuesta y lo envía al endpoint /api/audio/play
#   4. El servidor reproduce el audio en los parlantes usando PulseAudio/ffmpeg

# Stage 1: Build frontend
FROM node:20-alpine AS builder

# Instalar pnpm
RUN npm install -g pnpm@10.13.1

WORKDIR /app

# Copiar archivos de configuración
COPY package.json pnpm-lock.yaml* ./

# Instalar dependencias
RUN pnpm install --frozen-lockfile || pnpm install

# Copiar código fuente
COPY . .

# Construir frontend
RUN pnpm run build

# Stage 2: Production image
FROM node:20-slim

# Instalar dependencias del sistema para el endpoint /api/audio/play
# - pulseaudio (paplay): reproduce archivos WAV directamente
# - ffmpeg (ffplay): reproduce webm, mp3, ogg y otros formatos multimedia
# - curl: para healthchecks
RUN apt-get update && apt-get install -y \
    pulseaudio \
    pulseaudio-utils \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Instalar pnpm
RUN npm install -g pnpm@10.13.1

WORKDIR /app

# Copiar package.json y instalar solo dependencias de producción
# Dependencias del endpoint /api/audio/play: express (servidor), multer (upload de archivos)
COPY package.json ./
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod

# Copiar código del servidor
COPY server.js ./

# Copiar archivos construidos del frontend desde el builder
COPY --from=builder /app/dist ./dist

# Crear directorio para archivos temporales de audio del endpoint /api/audio/play
# El endpoint guarda archivos temporalmente antes de reproducirlos
RUN mkdir -p temp && chmod 777 temp

# Exponer puerto
EXPOSE 3000

# Variable de entorno para PulseAudio (requerida por el endpoint /api/audio/play)
# Permite que paplay y ffplay se conecten al servidor PulseAudio del host
ENV PULSE_SERVER=unix:/run/user/1000/pulse/native

# Comando para iniciar el servidor
CMD ["node", "server.js"]

