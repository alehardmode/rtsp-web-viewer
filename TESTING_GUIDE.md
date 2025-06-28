# 🧪 Guía Completa de Pruebas - RTSP Web Viewer

Esta guía te llevará paso a paso para probar completamente la aplicación RTSP Web Viewer, desde la instalación hasta las pruebas avanzadas.

## 📋 Índice

- [Preparación del Entorno](#preparación-del-entorno)
- [Instalación y Configuración](#instalación-y-configuración)
- [Pruebas Básicas](#pruebas-básicas)
- [Pruebas con Cámaras Reales](#pruebas-con-cámaras-reales)
- [Pruebas de Funcionalidad](#pruebas-de-funcionalidad)
- [Pruebas de Seguridad](#pruebas-de-seguridad)
- [Troubleshooting](#troubleshooting)
- [URLs de Prueba](#urls-de-prueba)

## 🔧 Preparación del Entorno

### Requisitos Mínimos del Sistema

```bash
# Verificar versiones
node --version    # >= 14.0.0
npm --version     # >= 6.0.0
ffmpeg -version   # Cualquier versión reciente
```

### 1. Instalación de Node.js

**macOS (con Homebrew):**
```bash
brew install node
```

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Windows:**
- Descargar desde [nodejs.org](https://nodejs.org/)

### 2. Instalación de FFmpeg

**macOS (con Homebrew):**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Windows:**
```bash
# Con Chocolatey
choco install ffmpeg

# O descargar desde https://ffmpeg.org/download.html
```

### 3. Verificar Instalaciones

```bash
# Verificar Node.js
node --version
npm --version

# Verificar FFmpeg
ffmpeg -version
which ffmpeg

# Verificar conectividad
ping google.com
```

## 🚀 Instalación y Configuración

### Paso 1: Preparar el Proyecto

```bash
# Si no tienes el proyecto, clónalo o descárgalo
cd rtsp-web-viewer

# Verificar archivos principales
ls -la
# Deberías ver: package.json, server.js, public/, etc.
```

### Paso 2: Instalación Automática (Recomendado)

```bash
# Ejecutar script de instalación automática
chmod +x start.sh
./start.sh

# Seguir las instrucciones en pantalla
```

### Paso 3: Instalación Manual

```bash
# Instalar dependencias
npm install

# Verificar que no hay vulnerabilidades
npm audit

# Crear directorios necesarios
mkdir -p public/streams logs

# Copiar configuración de ejemplo
cp .env.example .env

# Editar configuración (opcional)
nano .env
```

### Paso 4: Primera Ejecución

```bash
# Iniciar en modo desarrollo
npm run dev

# O en modo producción
npm start
```

**Salida esperada:**
```
RTSP Web Viewer server running on port 3000
Open http://localhost:3000 in your browser
FFmpeg stdout: ...
```

## 🧪 Pruebas Básicas

### Test 1: Verificar Servidor Web

```bash
# En otra terminal, verificar que el servidor responde
curl -I http://localhost:3000

# Respuesta esperada:
# HTTP/1.1 200 OK
# Content-Type: text/html
```

### Test 2: Verificar API REST

```bash
# Listar streams activos (debería estar vacío)
curl http://localhost:3000/api/streams

# Respuesta esperada:
# {"streams":[]}
```

### Test 3: Verificar Interfaz Web

1. **Abrir navegador** en `http://localhost:3000`
2. **Verificar elementos:**
   - ✅ Título "RTSP Web Viewer"
   - ✅ Formulario de configuración
   - ✅ Campo URL RTSP
   - ✅ Campo ID del Stream
   - ✅ Botones de control
   - ✅ Panel de video
   - ✅ Lista de streams activos
   - ✅ Registro de actividad

### Test 4: Verificar Logs

```bash
# Revisar logs del servidor
tail -f logs/combined.log

# O ver en la consola donde corre el servidor
```

## 📹 Pruebas con Cámaras Reales

### Preparación: Encontrar Cámaras RTSP

#### Opción A: Cámaras IP Físicas

1. **Identificar cámaras en la red:**
```bash
# Escanear red local
nmap -p 554 192.168.1.0/24

# Buscar servicios RTSP
nmap -p 554 --open 192.168.1.0/24
```

2. **Probar conectividad:**
```bash
# Probar con VLC (si está instalado)
vlc rtsp://192.168.1.100:554/stream1

# Probar con FFmpeg
ffmpeg -i rtsp://admin:password@192.168.1.100:554/stream1 -t 5 -f null -
```

#### Opción B: Cámaras USB con RTSP Server

```bash
# Crear servidor RTSP local con cámara USB
# (requiere software adicional como OBS o FFmpeg)

# Ejemplo con FFmpeg:
ffmpeg -f v4l2 -i /dev/video0 -c:v libx264 -preset ultrafast -f rtsp rtsp://localhost:8554/stream
```

### Test 5: Stream de Cámara Real

1. **Configurar en la interfaz web:**
   - URL RTSP: `rtsp://admin:password@192.168.1.100:554/stream1`
   - ID del Stream: `camara-oficina-1`

2. **Iniciar stream:**
   - Clic en "🎬 Iniciar Stream"
   - Esperar mensaje de éxito
   - Verificar logs en tiempo real

3. **Reproducir video:**
   - Clic en "📺 Ver" en el stream activo
   - Esperar carga del video (2-5 segundos)
   - Verificar reproducción fluida

### Test 6: Múltiples Streams

```bash
# Probar límite de streams concurrentes
# Por defecto: máximo 5 streams

# Stream 1
curl -X POST http://localhost:3000/api/stream/start \
  -H "Content-Type: application/json" \
  -d '{"rtspUrl":"rtsp://demo:demo@192.168.1.100:554/stream1","streamId":"test1"}'

# Stream 2
curl -X POST http://localhost:3000/api/stream/start \
  -H "Content-Type: application/json" \
  -d '{"rtspUrl":"rtsp://demo:demo@192.168.1.101:554/stream1","streamId":"test2"}'

# Verificar ambos streams
curl http://localhost:3000/api/streams
```

## 🔍 Pruebas de Funcionalidad

### Test 7: Gestión de Streams

#### A. Iniciar Stream
```bash
curl -X POST http://localhost:3000/api/stream/start \
  -H "Content-Type: application/json" \
  -d '{
    "rtspUrl": "rtsp://demo:demo@192.168.1.100:554/stream1",
    "streamId": "test-stream-1"
  }'

# Respuesta esperada:
# {"success":true,"streamId":"test-stream-1","hlsUrl":"/streams/test-stream-1/stream.m3u8"}
```

#### B. Listar Streams
```bash
curl http://localhost:3000/api/streams

# Respuesta esperada:
# {"streams":[{"id":"test-stream-1","rtspUrl":"rtsp://...","startTime":"...","hlsUrl":"..."}]}
```

#### C. Estado del Stream
```bash
curl http://localhost:3000/api/stream/test-stream-1/status

# Respuesta esperada:
# {"id":"test-stream-1","rtspUrl":"rtsp://...","active":true}
```

#### D. Detener Stream
```bash
curl -X POST http://localhost:3000/api/stream/stop \
  -H "Content-Type: application/json" \
  -d '{"streamId": "test-stream-1"}'

# Respuesta esperada:
# {"success":true,"message":"Stream stopped successfully"}
```

### Test 8: Validación de Entrada

#### A. URL Inválida
```bash
curl -X POST http://localhost:3000/api/stream/start \
  -H "Content-Type: application/json" \
  -d '{"rtspUrl":"http://invalid.com","streamId":"test"}'

# Respuesta esperada:
# {"error":"Only RTSP protocol is allowed"}
```

#### B. ID Inválido
```bash
curl -X POST http://localhost:3000/api/stream/start \
  -H "Content-Type: application/json" \
  -d '{"rtspUrl":"rtsp://demo:demo@192.168.1.100:554/stream1","streamId":"test@invalid#"}'

# Respuesta esperada:
# {"error":"Stream ID must be alphanumeric (max 50 chars)"}
```

#### C. Stream Duplicado
```bash
# Iniciar stream
curl -X POST http://localhost:3000/api/stream/start \
  -H "Content-Type: application/json" \
  -d '{"rtspUrl":"rtsp://demo:demo@192.168.1.100:554/stream1","streamId":"duplicate"}'

# Intentar el mismo ID
curl -X POST http://localhost:3000/api/stream/start \
  -H "Content-Type: application/json" \
  -d '{"rtspUrl":"rtsp://demo:demo@192.168.1.100:554/stream2","streamId":"duplicate"}'

# Respuesta esperada:
# {"error":"Stream already active"}
```

### Test 9: Archivos HLS

```bash
# Verificar que se generan archivos HLS
ls -la public/streams/test-stream-1/

# Deberías ver:
# stream.m3u8 (playlist)
# stream0.ts, stream1.ts, ... (segmentos)

# Verificar contenido del playlist
cat public/streams/test-stream-1/stream.m3u8

# Contenido esperado:
# #EXTM3U
# #EXT-X-VERSION:3
# #EXT-X-TARGETDURATION:2
# ...
```

## 🔒 Pruebas de Seguridad

### Test 10: Rate Limiting

```bash
# Probar límite de requests (100 en 15 minutos)
for i in {1..15}; do
  curl -s http://localhost:3000/api/streams
  echo "Request $i completed"
done

# Probar límite de API (10 por minuto)
for i in {1..12}; do
  curl -s -X POST http://localhost:3000/api/stream/start \
    -H "Content-Type: application/json" \
    -d '{"rtspUrl":"rtsp://test","streamId":"test'$i'"}'
done

# Debería recibir error 429 después del request 10
```

### Test 11: Headers de Seguridad

```bash
# Verificar headers de seguridad
curl -I http://localhost:3000

# Verificar que incluye:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Referrer-Policy: no-referrer
# Content-Security-Policy: ...
```

### Test 12: Validación de URLs

```bash
# Intentar localhost (debería fallar)
curl -X POST http://localhost:3000/api/stream/start \
  -H "Content-Type: application/json" \
  -d '{"rtspUrl":"rtsp://localhost:554/stream","streamId":"test"}'

# Respuesta esperada:
# {"error":"Localhost URLs are not allowed"}

# Intentar protocolo incorrecto
curl -X POST http://localhost:3000/api/stream/start \
  -H "Content-Type: application/json" \
  -d '{"rtspUrl":"http://demo.com/stream","streamId":"test"}'

# Respuesta esperada:
# {"error":"Only RTSP protocol is allowed"}
```

## 🌐 URLs de Prueba

### Streams RTSP Públicos de Prueba

⚠️ **Nota**: Los streams públicos pueden no estar siempre disponibles.

```bash
# Big Buck Bunny (video de prueba)
rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mov

# Blender Foundation
rtsp://wowzaec2demo.streamlock.net/vod/mp4:sintel_trailer-480p.mp4

# Cámaras IP públicas (verificar disponibilidad)
rtsp://cam-server.com:554/live
```

### Crear Stream de Prueba Local

```bash
# Crear video de prueba con FFmpeg
ffmpeg -f lavfi -i testsrc=duration=300:size=640x480:rate=25 \
  -f lavfi -i sine=frequency=1000:duration=300 \
  -c:v libx264 -c:a aac -f rtsp rtsp://localhost:8554/test &

# Usar en la aplicación:
# URL: rtsp://localhost:8554/test
# ID: test-local-stream
```

## 🚨 Troubleshooting

### Problema 1: FFmpeg no encontrado

**Síntomas:**
```
Error: spawn ffmpeg ENOENT
```

**Solución:**
```bash
# Verificar instalación
which ffmpeg
ffmpeg -version

# En Windows, verificar PATH
echo $PATH | grep ffmpeg

# Instalar si no está presente
# (ver sección de instalación arriba)
```

### Problema 2: Puerto ocupado

**Síntomas:**
```
Error: listen EADDRINUSE :::3000
```

**Solución:**
```bash
# Encontrar proceso usando el puerto
lsof -i :3000
# o en Windows
netstat -ano | findstr :3000

# Terminar proceso
kill -9 <PID>

# O usar puerto diferente
PORT=3001 npm start
```

### Problema 3: Stream no se reproduce

**Diagnóstico:**
```bash
# 1. Verificar que FFmpeg está procesando
ps aux | grep ffmpeg

# 2. Verificar archivos HLS
ls -la public/streams/tu-stream-id/

# 3. Probar URL RTSP directamente
ffmpeg -i rtsp://tu-url -t 5 -f null -

# 4. Verificar conectividad
ping ip-de-la-camara
telnet ip-de-la-camara 554
```

**Soluciones comunes:**
- Verificar credenciales de la cámara
- Comprobar URL RTSP correcta
- Verificar conectividad de red
- Revisar logs del servidor para errores específicos

### Problema 4: High CPU Usage

**Diagnóstico:**
```bash
# Monitor de recursos
top | grep ffmpeg
htop

# Verificar número de streams
curl http://localhost:3000/api/streams
```

**Soluciones:**
- Limitar streams concurrentes
- Reducir calidad de video
- Usar hardware acceleration si está disponible

### Problema 5: Memoria aumenta constantemente

**Diagnóstico:**
```bash
# Monitor de memoria
ps aux | grep node
free -h

# Verificar archivos temporales
du -sh public/streams/
```

**Soluciones:**
- Verificar cleanup de archivos HLS
- Restart periódico del servidor
- Configurar límites de memoria

## ✅ Checklist de Pruebas Completas

### Pruebas Básicas
- [ ] Servidor inicia correctamente
- [ ] Interfaz web carga sin errores
- [ ] API REST responde
- [ ] Logs se generan correctamente

### Pruebas Funcionales
- [ ] Iniciar stream RTSP exitoso
- [ ] Video se reproduce en el navegador
- [ ] Detener stream funciona
- [ ] Múltiples streams simultáneos
- [ ] Cleanup automático de archivos

### Pruebas de Seguridad
- [ ] Rate limiting funciona
- [ ] Headers de seguridad presentes
- [ ] Validación de entrada efectiva
- [ ] URLs maliciosas bloqueadas

### Pruebas de Rendimiento
- [ ] CPU usage razonable (<50% con 3 streams)
- [ ] Memoria estable (no leaks)
- [ ] Latencia de video aceptable (<5 segundos)
- [ ] Cleanup de archivos temporales

### Pruebas de Red
- [ ] Funciona en red local
- [ ] Funciona con cámaras reales
- [ ] Maneja desconexiones de red
- [ ] Reconexión automática

## 📊 Métricas de Éxito

### Rendimiento Esperado
- **Tiempo de inicio de stream**: < 5 segundos
- **Latencia de video**: 2-10 segundos
- **CPU con 1 stream**: < 20%
- **CPU con 5 streams**: < 60%
- **Memoria base**: < 100MB
- **Memoria por stream**: < 50MB adicional

### Calidad de Video
- **Resolución**: Mantiene resolución original
- **Frame rate**: Estable según configuración
- **Calidad**: Sin artifacts visibles
- **Audio**: Sincronizado si está presente

## 🎉 Validación Final

Si todas las pruebas pasan exitosamente, ¡felicidades! Tu instalación de RTSP Web Viewer está funcionando correctamente y lista para uso en producción.

### Próximos Pasos
1. **Configurar para producción** (HTTPS, reverse proxy)
2. **Implementar monitoring** continuo
3. **Configurar backups** de configuración
4. **Documentar URLs de cámaras** específicas
5. **Entrenar usuarios** finales

---

🔧 **Soporte**: Si encuentras problemas no cubiertos en esta guía, revisa el README.md y SECURITY.md para información adicional.

📞 **Reportar Issues**: Crea un issue detallado con logs y pasos para reproducir el problema.