#!/bin/sh

# Script de entrada para nginx que maneja la inicialización de SSL

# Verificar si los certificados SSL existen
if [ ! -f /etc/letsencrypt/live/input.vvaldes.me/fullchain.pem ]; then
    echo "⚠️  Certificados SSL no encontrados, usando configuración temporal..."
    # Usar configuración temporal (solo HTTP)
    cp /etc/nginx/nginx-init.conf /etc/nginx/nginx.conf
else
    echo "✅ Certificados SSL encontrados, usando configuración completa..."
    # Usar configuración completa con SSL
    cp /etc/nginx/nginx-full.conf /etc/nginx/nginx.conf
fi

# Ejecutar nginx
exec nginx -g 'daemon off;'

