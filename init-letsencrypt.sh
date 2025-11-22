#!/bin/bash

# Script para inicializar certificados SSL de Let's Encrypt
# Uso: ./init-letsencrypt.sh

DOMAIN="input.vvaldes.me"
EMAIL="vvaldesf@protonmail.com"  # Cambia esto por tu email

echo "🚀 Iniciando configuración de SSL para $DOMAIN"

# Verificar que docker compose está disponible
if ! docker compose version &> /dev/null; then
    echo "❌ docker compose no está instalado"
    exit 1
fi

# Detener contenedores existentes si están corriendo
echo "🛑 Deteniendo contenedores existentes..."
docker compose down 2>/dev/null || true

# Iniciar nginx con configuración temporal (sin esperar a la app)
echo "📦 Iniciando nginx con configuración temporal..."
# Iniciar nginx sin la dependencia de la app para obtener certificados
docker compose up -d --no-deps nginx

# Esperar a que nginx esté listo y verificar que responde
echo "⏳ Esperando a que nginx esté listo..."
for i in {1..30}; do
    if docker compose exec -T nginx wget --quiet --spider http://localhost/ > /dev/null 2>&1; then
        echo "✅ Nginx está listo"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Nginx no responde después de 30 intentos"
        echo "📋 Logs de nginx:"
        docker compose logs nginx | tail -20
        exit 1
    fi
    sleep 1
done
sleep 2

# Obtener certificados
echo "🔐 Obteniendo certificados SSL de Let's Encrypt..."
docker compose run --rm --entrypoint "" certbot sh -c "certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN"

# Verificar si los certificados se obtuvieron correctamente
echo "🔍 Verificando certificados..."
sleep 2

# Verificar en el volumen compartido (nginx también tiene acceso)
if docker compose exec -T nginx test -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem 2>/dev/null; then
    echo "✅ Certificados obtenidos exitosamente"
    
    # Recargar nginx con la configuración SSL completa
    echo "🔄 Reiniciando nginx con configuración SSL..."
    docker compose restart nginx
    
    echo ""
    echo "✅ Configuración SSL completada!"
    echo "🌐 Tu aplicación está disponible en https://$DOMAIN"
    echo ""
    echo "📝 Nota: Los certificados se renovarán automáticamente cada 12 horas"
else
    echo "❌ Error al obtener los certificados"
    echo ""
    echo "💡 Asegúrate de que:"
    echo "   - El dominio $DOMAIN apunta a este servidor (verifica con: dig $DOMAIN)"
    echo "   - Los puertos 80 y 443 están abiertos en el firewall"
    echo "   - El email $EMAIL es válido"
    echo ""
    echo "⚠️  Si usas Cloudflare:"
    echo "   - El error 521 significa que Cloudflare no puede conectarse al servidor"
    echo "   - Asegúrate de que Cloudflare esté en modo 'DNS Only' (gris) o 'Proxied' con SSL flexible"
    echo "   - O desactiva el proxy de Cloudflare temporalmente para obtener certificados"
    echo "   - Verifica que el servidor sea accesible directamente (sin Cloudflare)"
    echo ""
    echo "🔍 Para ver los logs de certbot, ejecuta:"
    echo "   docker compose logs certbot"
    echo ""
    echo "🔍 Para verificar que nginx está sirviendo el challenge:"
    echo "   curl http://$DOMAIN/.well-known/acme-challenge/test"
    exit 1
fi

