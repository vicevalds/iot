#!/bin/sh

# Script de entrada para Apache2 que maneja la inicialización de SSL
# Detecta automáticamente el dominio basado en los certificados disponibles

set -e

echo "🔧 Inicializando Apache2..."

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
    cp /usr/local/apache2/conf/apache2-init.conf /usr/local/apache2/conf/httpd.conf
else
    echo "✅ Certificados SSL encontrados para: $DOMAIN"

    # Reemplazar el dominio en la configuración si es necesario
    # (En caso de que el dominio sea diferente al hardcodeado)
    sed "s/iot\.vicevalds\.dev/$DOMAIN/g" /usr/local/apache2/conf/apache2-full.conf > /tmp/httpd.conf

    # Verificar que los certificados son válidos
    if openssl x509 -in "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" -noout -checkend 86400 > /dev/null 2>&1; then
        echo "✅ Certificados válidos (no expiran en las próximas 24 horas)"
    else
        echo "⚠️  Advertencia: Los certificados están próximos a expirar o son inválidos"
        echo "   El contenedor certbot debería renovarlos automáticamente"
    fi

    # Usar configuración completa con SSL
    cp /tmp/httpd.conf /usr/local/apache2/conf/httpd.conf
    rm -f /tmp/httpd.conf
fi

# Verificar la configuración de Apache antes de iniciar
echo "🔍 Verificando configuración de Apache2..."
if httpd -t 2>&1; then
    echo "✅ Configuración de Apache2 válida"
else
    echo "❌ Error en la configuración de Apache2"
    exit 1
fi

# Ejecutar Apache2 en primer plano
echo "🚀 Iniciando Apache2..."
exec httpd -D FOREGROUND
