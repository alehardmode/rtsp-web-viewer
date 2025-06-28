# 📹 Guía de Configuración de Cámaras RTSP

Esta guía contiene ejemplos de configuración para diferentes marcas y modelos de cámaras IP con soporte RTSP.

## 📋 Índice

- [Formato General de URLs RTSP](#formato-general-de-urls-rtsp)
- [Cámaras por Marca](#cámaras-por-marca)
- [Herramientas de Prueba](#herramientas-de-prueba)
- [Solución de Problemas](#solución-de-problemas)
- [Configuración de Red](#configuración-de-red)

## 🔗 Formato General de URLs RTSP

### Estructura Básica
```
rtsp://[usuario]:[contraseña]@[ip]:[puerto]/[ruta]
```

### Componentes
- **usuario**: Nombre de usuario de la cámara
- **contraseña**: Contraseña del usuario
- **ip**: Dirección IP de la cámara
- **puerto**: Puerto RTSP (por defecto 554)
- **ruta**: Ruta específica del stream

### Ejemplos Genéricos
```
# Stream principal
rtsp://admin:password@192.168.1.100:554/stream1

# Stream secundario (menor calidad)
rtsp://admin:password@192.168.1.100:554/stream2

# Sin autenticación
rtsp://192.168.1.100:554/live

# Puerto personalizado
rtsp://user:pass@192.168.1.100:8554/video
```

## 🏭 Cámaras por Marca

### Hikvision
```bash
# Stream principal
rtsp://admin:password@192.168.1.100:554/Streaming/Channels/101

# Stream secundario
rtsp://admin:password@192.168.1.100:554/Streaming/Channels/102

# Stream con canal específico
rtsp://admin:password@192.168.1.100:554/Streaming/Channels/1/Picture

# H.265 stream
rtsp://admin:password@192.168.1.100:554/Streaming/Channels/101?transportmode=unicast&profile=Profile_1
```

### Dahua
```bash
# Stream principal
rtsp://admin:password@192.168.1.100:554/cam/realmonitor?channel=1&subtype=0

# Stream secundario
rtsp://admin:password@192.168.1.100:554/cam/realmonitor?channel=1&subtype=1

# Múltiples canales
rtsp://admin:password@192.168.1.100:554/cam/realmonitor?channel=2&subtype=0

# Stream con perfil específico
rtsp://admin:password@192.168.1.100:554/cam/realmonitor?channel=1&subtype=0&unicast=true&proto=Onvif
```

### Axis
```bash
# Stream principal
rtsp://root:password@192.168.1.100:554/axis-media/media.amp

# Stream con resolución específica
rtsp://root:password@192.168.1.100:554/axis-media/media.amp?resolution=1920x1080

# Stream comprimido
rtsp://root:password@192.168.1.100:554/axis-media/media.amp?videocodec=h264&resolution=640x480

# Audio + Video
rtsp://root:password@192.168.1.100:554/axis-media/media.amp?audio=1&video=1
```

### Foscam
```bash
# Stream HD
rtsp://admin:password@192.168.1.100:554/videoMain

# Stream SD
rtsp://admin:password@192.168.1.100:554/videoSub

# Stream con usuario específico
rtsp://user:userpass@192.168.1.100:554/videoMain

# Puerto alternativo
rtsp://admin:password@192.168.1.100:88/videoMain
```

### TP-Link (Tapo/Kasa)
```bash
# Stream principal
rtsp://admin:password@192.168.1.100:554/stream1

# Stream secundario
rtsp://admin:password@192.168.1.100:554/stream2

# Tapo cámaras
rtsp://admin:camera_password@192.168.1.100:554/stream1
```

### Reolink
```bash
# Stream HD
rtsp://admin:password@192.168.1.100:554/h264Preview_01_main

# Stream SD
rtsp://admin:password@192.168.1.100:554/h264Preview_01_sub

# Stream con perfil
rtsp://admin:password@192.168.1.100:554/Preview_01_main

# H.265 stream
rtsp://admin:password@192.168.1.100:554/h265Preview_01_main
```

### Ubiquiti (UniFi)
```bash
# Stream alta calidad
rtsp://username:password@192.168.1.100:554/s0

# Stream media calidad
rtsp://username:password@192.168.1.100:554/s1

# Stream baja calidad
rtsp://username:password@192.168.1.100:554/s2
```

### D-Link
```bash
# Stream principal
rtsp://admin:password@192.168.1.100:554/live1.sdp

# Stream secundario
rtsp://admin:password@192.168.1.100:554/live2.sdp

# Stream MJPEG
rtsp://admin:password@192.168.1.100:554/live3.sdp
```

### Netgear (Arlo Pro)
```bash
# Stream principal
rtsp://admin:password@192.168.1.100:554/unicast

# Stream con perfil
rtsp://admin:password@192.168.1.100:554/unicast/c1/s0/live
```

### Generic/ONVIF
```bash
# ONVIF estándar
rtsp://user:pass@192.168.1.100:554/onvif1

# Profile S
rtsp://user:pass@192.168.1.100:554/ProfileS

# MediaProfile_Channel1_MainStream
rtsp://user:pass@192.168.1.100:554/MediaProfile_Channel1_MainStream
```

## 🔧 Herramientas de Prueba

### VLC Media Player
```bash
# Probar stream desde línea de comandos
vlc rtsp://admin:password@192.168.1.100:554/stream1

# Información del stream
vlc --intf dummy --play-and-exit --run-time=5 rtsp://admin:password@192.168.1.100:554/stream1 2>&1 | grep -i codec
```

### FFmpeg
```bash
# Probar conectividad
ffmpeg -i rtsp://admin:password@192.168.1.100:554/stream1 -t 5 -f null -

# Obtener información del stream
ffprobe rtsp://admin:password@192.168.1.100:554/stream1

# Guardar muestra del video
ffmpeg -i rtsp://admin:password@192.168.1.100:554/stream1 -t 10 -c copy test.mp4
```

### OpenRTSP (Live555)
```bash
# Probar stream RTSP
openRTSP -V rtsp://admin:password@192.168.1.100:554/stream1

# Guardar stream por tiempo limitado
openRTSP -V -d 30 rtsp://admin:password@192.168.1.100:554/stream1 > test.264
```

### cURL (para HTTP streams)
```bash
# Probar si la cámara responde
curl -I http://192.168.1.100

# Probar autenticación
curl -u admin:password http://192.168.1.100
```

## 🚨 Solución de Problemas

### Errores Comunes

#### 1. "Connection refused" / "No route to host"
**Posibles causas:**
- IP incorrecta
- Cámara apagada o desconectada
- Firewall bloqueando conexión
- Puerto RTSP incorrecto

**Soluciones:**
```bash
# Verificar conectividad
ping 192.168.1.100

# Verificar puerto abierto
nmap -p 554 192.168.1.100
# o
telnet 192.168.1.100 554
```

#### 2. "Authentication failed" / "401 Unauthorized"
**Posibles causas:**
- Usuario/contraseña incorrectos
- Usuario sin permisos RTSP
- Autenticación deshabilitada

**Soluciones:**
- Verificar credenciales en la interfaz web de la cámara
- Crear usuario específico para RTSP
- Habilitar acceso sin autenticación (solo para pruebas)

#### 3. "Stream not found" / "404 Not Found"
**Posibles causas:**
- Ruta del stream incorrecta
- Stream no configurado
- Codec no soportado

**Soluciones:**
- Consultar manual de la cámara
- Probar rutas alternativas
- Verificar configuración de streams en la cámara

#### 4. "Timeout" / "Connection timeout"
**Posibles causas:**
- Red lenta o congestionada
- Cámara sobrecargada
- Múltiples conexiones simultáneas

**Soluciones:**
```bash
# Aumentar timeout en FFmpeg
ffmpeg -timeout 30000000 -i rtsp://...

# Usar protocolo TCP en lugar de UDP
rtsp://admin:password@192.168.1.100:554/stream1?tcp
```

### Problemas de Rendimiento

#### Video entrecortado o con lag
```bash
# Reducir buffer de red
ffmpeg -rtsp_transport tcp -probesize 32 -analyzeduration 0 -i rtsp://...

# Usar preset ultrafast
ffmpeg -i rtsp://... -preset ultrafast -tune zerolatency ...
```

#### Alto uso de CPU
```bash
# Usar hardware acceleration (si está disponible)
ffmpeg -hwaccel auto -i rtsp://...

# Reducir resolución
ffmpeg -i rtsp://... -s 640x480 ...

# Limitar frame rate
ffmpeg -i rtsp://... -r 15 ...
```

## 🌐 Configuración de Red

### Puertos Comunes
- **554**: Puerto estándar RTSP
- **8554**: Puerto alternativo RTSP
- **80/443**: Interfaz web de la cámara
- **37777**: Puerto Dahua TCP
- **34567**: Puerto Dahua UDP

### Configuración de Router

#### Port Forwarding (para acceso externo)
```
Puerto Externo: 8554
Puerto Interno: 554
IP Interna: 192.168.1.100
Protocolo: TCP/UDP
```

#### DMZ (no recomendado para producción)
```
IP DMZ: 192.168.1.100
```

### Configuración de Firewall

#### Linux (iptables)
```bash
# Permitir tráfico RTSP
sudo iptables -A INPUT -p tcp --dport 554 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 554 -j ACCEPT

# Permitir rango de puertos RTP (para datos de video)
sudo iptables -A INPUT -p udp --dport 1024:65535 -j ACCEPT
```

#### Windows Firewall
```powershell
# Permitir puerto RTSP
netsh advfirewall firewall add rule name="RTSP" dir=in action=allow protocol=TCP localport=554
```

## 📝 Lista de Verificación

### Antes de Configurar
- [ ] Cámara conectada y encendida
- [ ] IP asignada y accesible
- [ ] Credenciales de administrador disponibles
- [ ] Puerto RTSP habilitado en la cámara
- [ ] Firewall configurado correctamente

### Para Troubleshooting
- [ ] Probar con VLC o FFmpeg directamente
- [ ] Verificar logs de la cámara
- [ ] Comprobar ancho de banda disponible
- [ ] Revisar configuración de red
- [ ] Validar formato de URL RTSP

### Optimización
- [ ] Configurar múltiples perfiles de stream
- [ ] Ajustar calidad según uso
- [ ] Implementar autenticación segura
- [ ] Configurar backup/redundancia
- [ ] Monitorear rendimiento regularmente

## 🔐 Consideraciones de Seguridad

### Credenciales
- Cambiar contraseñas por defecto
- Usar contraseñas seguras
- Crear usuarios específicos para RTSP
- Rotar credenciales regularmente

### Red
- Usar VLANs para segregar cámaras
- Implementar VPN para acceso remoto
- Deshabilitar UPnP si no es necesario
- Mantener firmware actualizado

### Acceso
- Limitar IPs que pueden acceder
- Usar certificados para HTTPS
- Implementar rate limiting
- Auditar accesos regularmente

---

💡 **Tip**: Siempre consulta el manual específico de tu modelo de cámara, ya que las rutas RTSP pueden variar incluso dentro de la misma marca.

📞 **Soporte**: Si tu cámara no aparece en esta lista, busca en la documentación del fabricante o contacta al soporte técnico.