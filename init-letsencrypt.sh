#!/bin/bash

# Script para inicializar certificados SSL de Let's Encrypt en DigitalOcean
# Uso: ./init-letsencrypt.sh [DOMAIN] [EMAIL]
# Ejemplo: ./init-letsencrypt.sh example.com user@example.com

DOMAIN="${1:-input.vvaldes.me}"
EMAIL="${2:-vvaldesf@protonmail.com}"

echo "🚀 Iniciando configuración de SSL para $DOMAIN"
echo "📧 Email: $EMAIL"
echo ""

# Verificar que docker compose está disponible
if ! docker compose version &> /dev/null; then
    echo "❌ docker compose no está instalado"
    echo "   Instala con: sudo apt-get update && sudo apt-get install docker-compose-plugin"
    exit 1
fi

# Verificar que el dominio apunta al servidor
echo "🔍 Verificando que el dominio apunta a este servidor..."
SERVER_IP=$(curl -s ifconfig.me || curl -s icanhazip.com || echo "unknown")
DOMAIN_IP=$(dig +short $DOMAIN | tail -n1 || echo "unknown")

if [ "$DOMAIN_IP" != "$SERVER_IP" ] && [ "$DOMAIN_IP" != "unknown" ] && [ "$SERVER_IP" != "unknown" ]; then
    echo "⚠️  Advertencia: El dominio $DOMAIN ($DOMAIN_IP) no apunta a este servidor ($SERVER_IP)"
    echo "   Continúe solo si está seguro de que el DNS está configurado correctamente"
    read -p "¿Continuar? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ Verificación de DNS OK"
fi

# Detener contenedores existentes si están corriendo
echo ""
echo "🛑 Deteniendo contenedores existentes..."
docker compose down 2>/dev/null || true

# Crear directorio para certbot si no existe
echo "📁 Creando directorios necesarios..."
docker volume create certbot-www 2>/dev/null || true
docker volume create certbot-conf 2>/dev/null || true

# Iniciar nginx con configuración temporal (sin esperar a la app)
echo "📦 Iniciando nginx con configuración temporal..."
docker compose up -d --no-deps nginx

# Esperar a que nginx esté listo y verificar que responde
echo "⏳ Esperando a que nginx esté listo..."
MAX_ATTEMPTS=60
for i in $(seq 1 $MAX_ATTEMPTS); do
    if docker compose exec -T nginx wget --quiet --spider http://localhost/ > /dev/null 2>&1; then
        echo "✅ Nginx está listo"
        break
    fi
    if [ $i -eq $MAX_ATTEMPTS ]; then
        echo "❌ Nginx no responde después de $MAX_ATTEMPTS intentos"
        echo "📋 Logs de nginx:"
        docker compose logs nginx | tail -30
        echo ""
        echo "💡 Intenta verificar:"
        echo "   - docker compose ps"
        echo "   - docker compose logs nginx"
        exit 1
    fi
    printf "."
    sleep 1
done
echo ""

# Verificar que el challenge de Let's Encrypt es accesible
echo "🔍 Verificando acceso al challenge de Let's Encrypt..."
TEST_CHALLENGE=$(echo "test" | docker compose exec -T nginx sh -c "mkdir -p /var/www/certbot/.well-known/acme-challenge && echo 'test' > /var/www/certbot/.well-known/acme-challenge/test && cat /var/www/certbot/.well-known/acme-challenge/test" 2>/dev/null)
if [ -z "$TEST_CHALLENGE" ]; then
    echo "⚠️  No se pudo crear el archivo de prueba del challenge"
fi

# Obtener certificados
echo ""
echo "🔐 Obteniendo certificados SSL de Let's Encrypt..."
echo "   Esto puede tardar unos minutos..."

if docker compose run --rm --entrypoint "" certbot sh -c "certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    --preferred-challenges http \
    -d $DOMAIN" 2>&1 | tee /tmp/certbot-init.log; then
    echo ""
    echo "✅ Certbot completó exitosamente"
else
    echo ""
    echo "❌ Error al obtener certificados"
    exit 1
fi

# Verificar si los certificados se obtuvieron correctamente
echo ""
echo "🔍 Verificando certificados..."
sleep 3

# Verificar en el volumen compartido (nginx también tiene acceso)
if docker compose exec -T nginx test -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem 2>/dev/null; then
    echo "✅ Certificados encontrados en /etc/letsencrypt/live/$DOMAIN/"
    
    # Mostrar información de los certificados
    echo ""
    echo "📜 Información de los certificados:"
    docker compose exec -T nginx sh -c "openssl x509 -in /etc/letsencrypt/live/$DOMAIN/fullchain.pem -noout -dates 2>/dev/null || echo 'No se pudo leer la información del certificado'" || true
    
    # Recargar nginx con la configuración SSL completa
    echo ""
    echo "🔄 Reiniciando nginx con configuración SSL..."
    docker compose restart nginx
    
    # Esperar a que nginx se reinicie
    sleep 3
    
    # Verificar que nginx está funcionando con SSL
    echo "🔍 Verificando configuración de nginx..."
    if docker compose exec -T nginx nginx -t 2>&1; then
        echo "✅ Configuración de nginx válida"
    else
        echo "❌ Error en la configuración de nginx"
        docker compose logs nginx | tail -30
        exit 1
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ ¡Configuración SSL completada exitosamente!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🌐 Tu aplicación está disponible en:"
    echo "   • HTTPS: https://$DOMAIN"
    echo "   • HTTP:  http://$DOMAIN (redirige automáticamente a HTTPS)"
    echo ""
    echo "📝 Notas importantes:"
    echo "   • Los certificados se renovarán automáticamente cada 12 horas"
    echo "   • Los certificados expiran cada 90 días, pero se renuevan automáticamente"
    echo "   • Si necesitas reiniciar los servicios: docker compose restart"
    echo ""
    echo "🔍 Para verificar el estado:"
    echo "   docker compose ps"
    echo "   docker compose logs nginx"
    echo "   docker compose logs certbot"
    echo ""
else
    echo "❌ Error: Los certificados no se encontraron después de la obtención"
    echo ""
    echo "📋 Logs de certbot:"
    cat /tmp/certbot-init.log | tail -50
    echo ""
    echo "💡 Solución de problemas:"
    echo ""
    echo "1. Verifica que el dominio apunta correctamente:"
    echo "   dig $DOMAIN"
    echo "   curl -I http://$DOMAIN/.well-known/acme-challenge/test"
    echo ""
    echo "2. Verifica que los puertos están abiertos en DigitalOcean:"
    echo "   • En el panel de DigitalOcean, ve a Networking > Firewalls"
    echo "   • Asegúrate de que los puertos 80 (HTTP) y 443 (HTTPS) estén abiertos"
    echo "   • O ejecuta: sudo ufw allow 80/tcp && sudo ufw allow 443/tcp"
    echo ""
    echo "3. Si usas Cloudflare o un proxy similar:"
    echo "   • Configura el modo DNS como 'DNS Only' (gris) temporalmente"
    echo "   • O usa 'Proxied' con SSL flexible"
    echo "   • Después de obtener certificados, puedes volver a tu configuración original"
    echo ""
    echo "4. Verifica los logs:"
    echo "   docker compose logs nginx"
    echo "   docker compose logs certbot"
    echo ""
    echo "5. Intenta obtener certificados manualmente:"
    echo "   docker compose run --rm --entrypoint '' certbot certbot certonly --webroot --webroot-path=/var/www/certbot -d $DOMAIN --email $EMAIL --agree-tos --no-eff-email"
    echo ""
    exit 1
fi

