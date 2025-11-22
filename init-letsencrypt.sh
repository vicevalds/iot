#!/bin/bash

# Script para inicializar certificados SSL de Let's Encrypt
# Uso: ./init-letsencrypt.sh

DOMAIN="input.vvaldes.me"
EMAIL="vvaldesf@protonmail.com"  # Cambia esto por tu email

echo "🚀 Iniciando configuración de SSL para $DOMAIN"

# Verificar que docker-compose está disponible
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose no está instalado"
    exit 1
fi

# Iniciar nginx con configuración temporal
echo "📦 Iniciando nginx con configuración temporal..."
docker-compose up -d nginx

# Esperar a que nginx esté listo
echo "⏳ Esperando a que nginx esté listo..."
sleep 5

# Obtener certificados
echo "🔐 Obteniendo certificados SSL de Let's Encrypt..."
docker-compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN

# Verificar si los certificados se obtuvieron correctamente
echo "🔍 Verificando certificados..."
sleep 2

if docker-compose exec -T certbot test -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem 2>/dev/null; then
    echo "✅ Certificados obtenidos exitosamente"
    
    # Recargar nginx con la configuración SSL completa
    echo "🔄 Reiniciando nginx con configuración SSL..."
    docker-compose restart nginx
    
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
    echo "🔍 Para ver los logs de certbot, ejecuta:"
    echo "   docker-compose logs certbot"
    exit 1
fi

