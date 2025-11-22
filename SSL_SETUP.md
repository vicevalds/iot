# Configuración SSL con Let's Encrypt

Este proyecto está configurado para usar nginx como proxy reverso con certificados SSL de Let's Encrypt para el dominio `input.vvaldes.me`.

## Requisitos previos

1. El dominio `input.vvaldes.me` debe apuntar a la IP de este servidor
2. Los puertos 80 y 443 deben estar abiertos en el firewall
3. Docker y docker-compose deben estar instalados

## Configuración inicial

### 1. Editar el email en el script de inicialización

Edita el archivo `init-letsencrypt.sh` y cambia el email:

```bash
EMAIL="tu-email@ejemplo.com"  # Cambia esto por tu email
```

### 2. Ejecutar el script de inicialización

```bash
./init-letsencrypt.sh
```

Este script:
- Inicia nginx con configuración temporal (solo HTTP)
- Obtiene los certificados SSL de Let's Encrypt
- Reinicia nginx con la configuración SSL completa

### 3. Iniciar todos los servicios

```bash
docker-compose up -d
```

## Estructura

- `nginx/nginx.conf`: Configuración completa de nginx con SSL
- `nginx/nginx-init.conf`: Configuración temporal para obtener certificados
- `nginx/entrypoint.sh`: Script que selecciona la configuración correcta según los certificados
- `init-letsencrypt.sh`: Script para obtener certificados SSL iniciales

## Renovación automática

Los certificados se renuevan automáticamente cada 12 horas mediante el contenedor `certbot`.

## Verificar certificados

Para verificar que los certificados están funcionando:

```bash
# Ver logs de nginx
docker-compose logs nginx

# Ver logs de certbot
docker-compose logs certbot

# Verificar certificados dentro del contenedor
docker-compose exec certbot ls -la /etc/letsencrypt/live/input.vvaldes.me/
```

## Solución de problemas

### Los certificados no se obtienen

1. Verifica que el dominio apunta al servidor:
   ```bash
   dig input.vvaldes.me
   ```

2. Verifica que los puertos están abiertos:
   ```bash
   sudo ufw status
   # O
   sudo iptables -L
   ```

3. Revisa los logs:
   ```bash
   docker-compose logs certbot
   ```

### Nginx no inicia con SSL

1. Verifica que los certificados existen:
   ```bash
   docker-compose exec certbot test -f /etc/letsencrypt/live/input.vvaldes.me/fullchain.pem
   ```

2. Verifica la configuración de nginx:
   ```bash
   docker-compose exec nginx nginx -t
   ```

## Acceso a la aplicación

Una vez configurado, la aplicación estará disponible en:
- **HTTPS**: https://input.vvaldes.me
- **HTTP**: http://input.vvaldes.me (redirige automáticamente a HTTPS)

