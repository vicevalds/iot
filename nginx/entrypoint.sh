#!/bin/sh

# Script de entrada para nginx que maneja la inicialización de SSL
# Detecta automáticamente el dominio basado en los certificados disponibles

set -e

echo "🔧 Inicializando nginx..."

# Buscar el dominio de los certificados disponibles
DOMAIN=""
if [ -d /etc/letsencrypt/live ]; then
    # Buscar el primer dominio con certificados válidos
    for dir in /etc/letsencrypt/live/*/; do
        if [ -f "$dir/fullchain.pem" ] && [ -f "$dir/privkey.pem" ]; then
            DOMAIN=$(basename "$dir")
            echo "✅ Certificados SSL encontrados para: $DOMAIN"
            break
        fi
    done
fi

# Si no se encontraron certificados, usar configuración temporal
if [ -z "$DOMAIN" ] || [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "⚠️  Certificados SSL no encontrados, usando configuración temporal (solo HTTP)..."
    echo "   Ejecuta ./init-letsencrypt.sh para obtener certificados SSL"
    
    # Usar configuración temporal (solo HTTP)
    cp /etc/nginx/nginx-init.conf /etc/nginx/nginx.conf
else
    echo "✅ Certificados SSL encontrados para: $DOMAIN"
    
    # Reemplazar el dominio en la configuración si es necesario
    # (En caso de que el dominio sea diferente al hardcodeado)
    sed "s/input.vvaldes.me/$DOMAIN/g" /etc/nginx/nginx-full.conf > /tmp/nginx.conf
    
    # Verificar que los certificados son válidos
    if openssl x509 -in "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" -noout -checkend 86400 > /dev/null 2>&1; then
        echo "✅ Certificados válidos (no expiran en las próximas 24 horas)"
    else
        echo "⚠️  Advertencia: Los certificados están próximos a expirar o son inválidos"
        echo "   El contenedor certbot debería renovarlos automáticamente"
    fi
    
    # Usar configuración completa con SSL
    cp /tmp/nginx.conf /etc/nginx/nginx.conf
    rm -f /tmp/nginx.conf
fi

# Verificar la configuración de nginx antes de iniciar
echo "🔍 Verificando configuración de nginx..."
if nginx -t 2>&1; then
    echo "✅ Configuración de nginx válida"
else
    echo "❌ Error en la configuración de nginx"
    exit 1
fi

# Ejecutar nginx en primer plano
echo "🚀 Iniciando nginx..."
exec nginx -g 'daemon off;'

