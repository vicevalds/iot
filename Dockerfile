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

# Instalar dependencias del sistema para reproducir audio
RUN apt-get update && apt-get install -y \
    pulseaudio \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Instalar pnpm
RUN npm install -g pnpm@10.13.1

WORKDIR /app

# Copiar package.json y instalar solo dependencias de producción
COPY package.json ./
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod

# Copiar código del servidor
COPY server.js ./

# Copiar archivos construidos del frontend desde el builder
COPY --from=builder /app/dist ./dist

# Crear directorio para archivos temporales de audio
RUN mkdir -p temp && chmod 777 temp

# Exponer puerto
EXPOSE 3000

# Variable de entorno para PulseAudio
ENV PULSE_SERVER=unix:/run/user/1000/pulse/native

# Comando para iniciar el servidor
CMD ["node", "server.js"]

