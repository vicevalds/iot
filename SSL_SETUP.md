# Configuración SSL con Let's Encrypt en DigitalOcean

Este proyecto está configurado para usar nginx como proxy reverso con certificados SSL de Let's Encrypt. Las instrucciones están optimizadas para servidores DigitalOcean.

## Requisitos previos

1. **Un Droplet en DigitalOcean** con Ubuntu 20.04 o superior
2. **Un dominio** apuntando a la IP de tu Droplet (registro A)
3. **Docker y Docker Compose** instalados
4. **Puertos 80 (HTTP) y 443 (HTTPS)** abiertos en el firewall

## Configuración en DigitalOcean

### 1. Configurar Firewall en DigitalOcean

**Opción A: Usar Firewall de DigitalOcean (Recomendado)**

1. Ve al panel de DigitalOcean → **Networking** → **Firewalls**
2. Crea un nuevo firewall o edita uno existente
3. Asegúrate de que las siguientes reglas estén configuradas:
   - **Inbound Rules:**
     - HTTP (puerto 80) - Permitir todo
     - HTTPS (puerto 443) - Permitir todo
     - SSH (puerto 22) - Permitir solo tu IP o todo
   - **Outbound Rules:**
     - Todo el tráfico permitido
4. Asigna el firewall a tu Droplet

**Opción B: Usar UFW en el servidor**

Si prefieres usar UFW directamente en el servidor:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
sudo ufw status
```

### 2. Configurar DNS

Asegúrate de que tu dominio apunta a la IP de tu Droplet:

```bash
# Verifica la IP de tu Droplet
curl -4 ifconfig.me

# Verifica que el DNS está configurado correctamente
dig tu-dominio.com
# Debe mostrar la IP de tu Droplet
```

### 3. Instalar Docker y Docker Compose (si no está instalado)

```bash
# Actualizar el sistema
sudo apt-get update
sudo apt-get upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Agregar tu usuario al grupo docker (reemplaza $USER con tu usuario)
sudo usermod -aG docker $USER

# Instalar Docker Compose Plugin
sudo apt-get install docker-compose-plugin -y

# Verificar instalación
docker --version
docker compose version

# Reiniciar sesión o ejecutar:
newgrp docker
```

## Configuración inicial de SSL

### 1. Editar el script de inicialización (opcional)

Puedes editar `init-letsencrypt.sh` para cambiar el dominio y email por defecto, o pasarlos como argumentos:

```bash
# Editar directamente
nano init-letsencrypt.sh

# O pasar como argumentos (recomendado)
./init-letsencrypt.sh tu-dominio.com tu-email@ejemplo.com
```

### 2. Hacer el script ejecutable

```bash
chmod +x init-letsencrypt.sh
```

### 3. Ejecutar el script de inicialización

```bash
# Con argumentos (recomendado)
./init-letsencrypt.sh tu-dominio.com tu-email@ejemplo.com

# O usando los valores por defecto del script
./init-letsencrypt.sh
```

Este script:
1. ✅ Verifica que Docker Compose está instalado
2. ✅ Verifica que el dominio apunta al servidor
3. ✅ Inicia nginx con configuración temporal (solo HTTP)
4. ✅ Espera a que nginx esté listo
5. ✅ Obtiene los certificados SSL de Let's Encrypt
6. ✅ Verifica que los certificados fueron obtenidos
7. ✅ Reinicia nginx con la configuración SSL completa

### 4. Iniciar todos los servicios (si aún no están corriendo)

```bash
# Si el script anterior no inició todos los servicios
docker compose up -d

# Verificar que todos los servicios están corriendo
docker compose ps
```

## Verificación

Una vez completada la configuración, verifica que todo funciona:

```bash
# 1. Verificar que los servicios están corriendo
docker compose ps

# 2. Verificar certificados SSL
docker compose exec nginx ls -la /etc/letsencrypt/live/

# 3. Probar acceso HTTPS desde el servidor
curl -I https://tu-dominio.com

# 4. Verificar redirección HTTP -> HTTPS
curl -I http://tu-dominio.com
# Debe mostrar: HTTP/1.1 301 Moved Permanently

# 5. Verificar certificado SSL desde navegador
# Visita: https://tu-dominio.com
# Debe mostrar el candado verde ✅
```

## Estructura

- `nginx/nginx.conf`: Configuración completa de nginx con SSL
- `nginx/nginx-init.conf`: Configuración temporal para obtener certificados
- `nginx/entrypoint.sh`: Script que selecciona la configuración correcta según los certificados
- `init-letsencrypt.sh`: Script para obtener certificados SSL iniciales

## Renovación automática

Los certificados se renuevan **automáticamente cada 12 horas** mediante el contenedor `certbot`. Los certificados de Let's Encrypt expiran cada 90 días, pero con la renovación automática nunca deberían expirar.

### Verificar renovación automática

```bash
# Ver logs del contenedor certbot
docker compose logs certbot

# Ver última renovación
docker compose exec certbot certbot certificates

# Probar renovación manual (dry-run)
docker compose exec certbot certbot renew --dry-run
```

### Forzar renovación manual

Si necesitas renovar manualmente:

```bash
# Renovar todos los certificados
docker compose exec certbot certbot renew --webroot --webroot-path=/var/www/certbot

# Reiniciar nginx para cargar nuevos certificados
docker compose restart nginx
```

## Monitoreo y mantenimiento

### Verificar certificados

```bash
# Ver información de los certificados
docker compose exec nginx openssl x509 -in /etc/letsencrypt/live/input.vicevalds.dev/fullchain.pem -noout -dates

# Ver logs de nginx
docker compose logs -f nginx

# Ver logs de certbot
docker compose logs -f certbot

# Ver estado de todos los servicios
docker compose ps
```

### Verificar configuración de nginx

```bash
# Probar configuración
docker compose exec nginx nginx -t

# Ver configuración activa
docker compose exec nginx cat /etc/nginx/nginx.conf
```

## Solución de problemas

### Los certificados no se obtienen

**Error: Challenge failed**

1. **Verifica DNS:**
   ```bash
   dig tu-dominio.com
   # Debe mostrar la IP de tu Droplet
   
   # Verificar desde fuera
   curl -I http://tu-dominio.com
   ```

2. **Verifica firewall en DigitalOcean:**
   - Ve a **Networking** → **Firewalls**
   - Asegúrate de que los puertos 80 y 443 están abiertos
   - Verifica que el firewall está asignado a tu Droplet

3. **Verifica puertos en el servidor:**
   ```bash
   # Verificar que nginx está escuchando
   sudo netstat -tlnp | grep -E ':(80|443)'
   # O
   sudo ss -tlnp | grep -E ':(80|443)'
   ```

4. **Si usas Cloudflare o proxy similar:**
   - Configura el modo DNS como **"DNS Only"** (gris) temporalmente
   - O usa **"Proxied"** con **SSL Flexible**
   - El servidor debe ser accesible directamente (sin proxy) para el challenge

5. **Revisa los logs:**
   ```bash
   docker compose logs certbot
   docker compose logs nginx
   ```

### Nginx no inicia con SSL

1. **Verifica que los certificados existen:**
   ```bash
   docker compose exec nginx test -f /etc/letsencrypt/live/input.vicevalds.dev/fullchain.pem && echo "OK" || echo "FALTA"
   docker compose exec nginx ls -la /etc/letsencrypt/live/
   ```

2. **Verifica la configuración de nginx:**
   ```bash
   docker compose exec nginx nginx -t
   ```

3. **Verifica permisos de los certificados:**
   ```bash
   docker compose exec nginx ls -la /etc/letsencrypt/live/input.vicevalds.dev/
   ```

4. **Reinicia los servicios:**
   ```bash
   docker compose down
   docker compose up -d
   ```

### Error: "Connection refused" o "502 Bad Gateway"

1. **Verifica que la app está corriendo:**
   ```bash
   docker compose ps
   docker compose logs app
   ```

2. **Verifica conectividad entre contenedores:**
   ```bash
   docker compose exec nginx ping -c 3 app
   ```

### Error: "SSL: certificate verify failed"

Esto puede ocurrir si OCSP stapling no está configurado correctamente. El script debería manejarlo automáticamente, pero si persiste:

```bash
# Verificar que chain.pem existe
docker compose exec nginx test -f /etc/letsencrypt/live/input.vicevalds.dev/chain.pem
```

## Acceso a la aplicación

Una vez configurado, la aplicación estará disponible en:
- **HTTPS**: `https://tu-dominio.com` ✅ (principal)
- **HTTP**: `http://tu-dominio.com` → Redirige automáticamente a HTTPS 🔒

## Recursos adicionales

- [Documentación de Let's Encrypt](https://letsencrypt.org/docs/)
- [Guía de Nginx con SSL](https://www.nginx.com/blog/using-free-ssltls-certificates-from-lets-encrypt-with-nginx/)
- [Mejores prácticas de SSL/TLS](https://ssl-config.mozilla.org/)
- [Firewall de DigitalOcean](https://docs.digitalocean.com/products/networking/firewalls/)

## Seguridad adicional

El proyecto ya incluye:
- ✅ Redirección automática HTTP → HTTPS
- ✅ HSTS (HTTP Strict Transport Security)
- ✅ Headers de seguridad (X-Frame-Options, X-Content-Type-Options, etc.)
- ✅ OCSP Stapling para mejor rendimiento
- ✅ Configuración SSL/TLS moderna (TLS 1.2 y 1.3)
- ✅ Renovación automática de certificados
- ✅ Rate limiting para protección DDoS

