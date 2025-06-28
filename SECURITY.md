# 🔒 Guía de Seguridad - RTSP Web Viewer

Esta guía detalla las medidas de seguridad implementadas y las mejores prácticas para un despliegue seguro del RTSP Web Viewer.

## 📋 Índice

- [Medidas de Seguridad Implementadas](#medidas-de-seguridad-implementadas)
- [Análisis de Dependencias](#análisis-de-dependencias)
- [Configuración Segura](#configuración-segura)
- [Mejores Prácticas](#mejores-prácticas)
- [Auditoría y Monitoreo](#auditoría-y-monitoreo)
- [Respuesta a Incidentes](#respuesta-a-incidentes)

## 🛡️ Medidas de Seguridad Implementadas

### 1. Middleware de Seguridad

#### Helmet.js
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      mediaSrc: ["'self'", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));
```

**Protecciones incluidas:**
- Prevención de ataques XSS
- Protección contra clickjacking
- Control de Content Security Policy
- Headers de seguridad HTTP

#### Rate Limiting
```javascript
// Rate limiting general
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP
  message: "Demasiadas peticiones desde esta IP"
});

// Rate limiting para API
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 10, // máximo 10 requests de API por minuto
  message: "Demasiadas peticiones de API desde esta IP"
});
```

### 2. Validación de Entrada

#### Validación de URLs RTSP
```javascript
function validateRtspUrl(url) {
  try {
    const urlObj = new URL(url);
    
    // Solo protocolo RTSP permitido
    if (urlObj.protocol !== 'rtsp:') {
      return { valid: false, error: 'Solo protocolo RTSP permitido' };
    }
    
    // Bloquear localhost
    const hostname = urlObj.hostname;
    if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') {
      return { valid: false, error: 'URLs localhost no permitidas' };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: 'Formato de URL inválido' };
  }
}
```

#### Sanitización de Entrada
```javascript
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  // Remover caracteres peligrosos
  return input.replace(/[;&|`$(){}[\]\\]/g, '');
}
```

### 3. Prevención de Inyección de Comandos

- **Sanitización de URLs RTSP** antes de pasarlas a FFmpeg
- **Validación estricta** de identificadores de stream
- **Filtrado de caracteres** peligrosos en parámetros

### 4. Control de Recursos

#### Límites de Streams Concurrentes
```javascript
const maxStreams = process.env.MAX_CONCURRENT_STREAMS || 5;
if (activeStreams.size >= maxStreams) {
  return res.status(429).json({ 
    error: 'Límite de streams concurrentes alcanzado' 
  });
}
```

#### Timeouts de Procesos
```javascript
const timeout = setTimeout(() => {
  console.log(`Timeout para stream ${streamId}, terminando proceso`);
  ffmpeg.kill('SIGTERM');
  activeStreams.delete(streamId);
}, 300000); // 5 minutos timeout
```

## 📦 Análisis de Dependencias

### ✅ Dependencias Seguras y Actualizadas

| Paquete | Versión | Estado | Notas |
|---------|---------|--------|-------|
| express | ^4.18.2 | ✅ Seguro | Framework principal, bien mantenido |
| helmet | ^7.1.0 | ✅ Seguro | Middleware de seguridad HTTP |
| express-rate-limit | ^7.1.5 | ✅ Seguro | Rate limiting robusto |
| cors | ^2.8.5 | ✅ Seguro | Control de CORS estándar |
| fluent-ffmpeg | ^2.1.2 | ⚠️ Cuidado | Requiere validación de entrada |
| ws | ^8.13.0 | ✅ Seguro | WebSockets bien mantenidos |

### ❌ Dependencias Removidas por Seguridad

| Paquete | Razón de Remoción |
|---------|-------------------|
| node-rtsp-stream | Versión inmadura (0.0.9), proyecto abandonado |
| multer | No utilizado, superficie de ataque innecesaria |

### 🔍 Verificación Continua

```bash
# Auditar vulnerabilidades
npm audit

# Verificar actualizaciones de seguridad
npm audit fix

# Revisar dependencias obsoletas
npm outdated
```

## ⚙️ Configuración Segura

### Variables de Entorno Recomendadas

```env
# Límites de seguridad
MAX_CONCURRENT_STREAMS=5
STREAM_TIMEOUT=300000
CONNECTION_TIMEOUT=30000

# Rate limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
API_RATE_LIMIT_WINDOW=60000
API_RATE_LIMIT_MAX=10

# Configuración de red
ALLOWED_RTSP_HOSTS=192.168.1.0/24,10.0.0.0/8
BLOCKED_HOSTS=localhost,127.0.0.1,0.0.0.0

# Logging
LOG_LEVEL=info
ENABLE_ACCESS_LOG=true
LOG_FAILED_ATTEMPTS=true
```

### Configuración de Firewall

#### Linux (iptables)
```bash
# Permitir solo puertos necesarios
sudo iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 554 -j ACCEPT

# Bloquear acceso directo a FFmpeg
sudo iptables -A INPUT -p tcp --dport 8080:8090 -j DROP

# Rate limiting a nivel de red
sudo iptables -A INPUT -p tcp --dport 3000 -m limit --limit 25/minute --limit-burst 100 -j ACCEPT
```

#### Nginx Reverse Proxy (Recomendado)
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/m;
    limit_req_zone $binary_remote_addr zone=general:10m rate=100r/m;
    
    location /api/ {
        limit_req zone=api burst=5 nodelay;
        proxy_pass http://localhost:3000;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    location / {
        limit_req zone=general burst=20 nodelay;
        proxy_pass http://localhost:3000;
    }
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy strict-origin-when-cross-origin;
}
```

## 🔐 Mejores Prácticas

### 1. Despliegue en Producción

#### Usar HTTPS
```bash
# Con Let's Encrypt
sudo certbot --nginx -d your-domain.com
```

#### Configurar Usuario No-Root
```bash
# Crear usuario dedicado
sudo useradd -r -s /bin/false rtsp-viewer
sudo mkdir -p /opt/rtsp-web-viewer
sudo chown rtsp-viewer:rtsp-viewer /opt/rtsp-web-viewer

# Ejecutar con permisos limitados
sudo -u rtsp-viewer node server.js
```

#### Systemd Service
```ini
[Unit]
Description=RTSP Web Viewer
After=network.target

[Service]
Type=simple
User=rtsp-viewer
WorkingDirectory=/opt/rtsp-web-viewer
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

# Límites de seguridad
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/rtsp-web-viewer/public/streams

[Install]
WantedBy=multi-user.target
```

### 2. Configuración de Red

#### Segregación de Red
- Colocar cámaras en VLAN dedicada
- Usar firewall entre VLANs
- Limitar acceso solo a IPs necesarias

#### VPN para Acceso Remoto
```bash
# Usar WireGuard o OpenVPN
# No exponer directamente a internet
```

### 3. Monitoreo y Logging

#### Configurar Logging Detallado
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console()
  ]
});

// Log eventos de seguridad
logger.warn('Failed authentication attempt', { 
  ip: req.ip, 
  url: req.url, 
  timestamp: new Date() 
});
```

## 📊 Auditoría y Monitoreo

### 1. Métricas de Seguridad

#### Eventos a Monitorear
- Intentos de autenticación fallidos
- Rate limiting activado
- URLs RTSP inválidas
- Procesos FFmpeg anómalos
- Uso excesivo de recursos

#### Alertas Automáticas
```javascript
// Ejemplo de alerta por múltiples fallos
let failedAttempts = new Map();

function checkFailedAttempts(ip) {
  const attempts = failedAttempts.get(ip) || 0;
  if (attempts > 5) {
    // Enviar alerta
    sendSecurityAlert(`Multiple failed attempts from ${ip}`);
    // Bloquear IP temporalmente
    blockIP(ip, 3600000); // 1 hora
  }
  failedAttempts.set(ip, attempts + 1);
}
```

### 2. Auditoría Regular

#### Checklist Semanal
- [ ] Revisar logs de seguridad
- [ ] Verificar actualizaciones de dependencias
- [ ] Comprobar uso de recursos
- [ ] Validar configuración de firewall
- [ ] Revisar streams activos vs. esperados

#### Checklist Mensual
- [ ] Auditoría completa de npm
- [ ] Revisión de configuración de seguridad
- [ ] Test de penetración básico
- [ ] Backup de configuraciones
- [ ] Documentación actualizada

## 🚨 Respuesta a Incidentes

### 1. Procedimientos de Emergencia

#### Sospecha de Compromiso
```bash
# 1. Detener todos los streams
curl -X POST http://localhost:3000/api/emergency/stop-all

# 2. Revisar logs inmediatamente
tail -f /var/log/rtsp-viewer/combined.log | grep -i "error\|warning\|failed"

# 3. Verificar procesos FFmpeg
ps aux | grep ffmpeg

# 4. Comprobar conexiones de red
netstat -tulpn | grep :3000
```

#### Bloqueo de IP Sospechosa
```bash
# Bloquear IP inmediatamente
sudo iptables -A INPUT -s SUSPICIOUS_IP -j DROP

# Añadir a lista permanente
echo "SUSPICIOUS_IP" >> /etc/blocked-ips.conf
```

### 2. Análisis Post-Incidente

#### Información a Recopilar
- Logs completos del período del incidente
- Lista de streams activos durante el incidente
- IPs que accedieron al sistema
- Uso de recursos del sistema
- Configuración activa durante el incidente

#### Mejoras Posteriores
- Actualizar reglas de firewall
- Mejorar logging si es necesario
- Ajustar límites de rate limiting
- Actualizar documentación de procedimientos

## 🔄 Actualizaciones de Seguridad

### Proceso de Actualización

1. **Backup completo** antes de actualizar
2. **Probar en entorno de desarrollo**
3. **Revisar changelog** de dependencias
4. **Ejecutar auditoría** post-actualización
5. **Monitorear** por 24-48 horas

### Comandos de Mantenimiento

```bash
# Backup antes de actualizar
cp -r /opt/rtsp-web-viewer /opt/rtsp-web-viewer.backup.$(date +%Y%m%d)

# Actualizar dependencias de seguridad
npm audit fix --only=prod

# Verificar integridad después de actualizar
npm audit
npm ls --depth=0
```

## 📞 Contacto de Seguridad

Para reportar vulnerabilidades de seguridad:

- **No usar issues públicos** para vulnerabilidades
- **Contactar directamente** al maintainer
- **Incluir información detallada** del problema
- **Esperar confirmación** antes de divulgación pública

---

⚠️ **Importante**: Esta documentación debe revisarse y actualizarse regularmente conforme evoluciona el proyecto y aparecen nuevas amenazas de seguridad.

🔐 **Recordatorio**: La seguridad es un proceso continuo, no un estado final. Mantén siempre las mejores prácticas y actualiza regularmente.