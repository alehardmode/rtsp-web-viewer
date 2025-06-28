# 📹 RTSP Web Viewer

Una aplicación web moderna para visualizar cámaras RTSP directamente en tu navegador. Convierte streams RTSP a formato HLS para reproducción web compatible.

## ✨ Características

- 🎥 Visualización de cámaras RTSP en tiempo real
- 🌐 Interfaz web responsive y moderna
- 🔄 Conversión automática RTSP a HLS
- 📱 Compatible con dispositivos móviles
- 🎛️ Control de múltiples streams simultáneos
- 📊 Monitoreo de estado en tiempo real
- 🔧 Fácil configuración y uso
- 📝 Registro de actividad detallado

## 🛠️ Requisitos Previos

### Software Requerido

1. **Node.js** (versión 14 o superior)
   ```bash
   # Verificar instalación
   node --version
   npm --version
   ```

2. **FFmpeg** (requerido para conversión de video)
   
   **En macOS (con Homebrew):**
   ```bash
   brew install ffmpeg
   ```
   
   **En Ubuntu/Debian:**
   ```bash
   sudo apt update
   sudo apt install ffmpeg
   ```
   
   **En Windows:**
   - Descargar desde [https://ffmpeg.org/download.html](https://ffmpeg.org/download.html)
   - Agregar al PATH del sistema

3. **Verificar FFmpeg:**
   ```bash
   ffmpeg -version
   ```

## 🚀 Instalación Rápida

### ⚡ Instalación con Una Línea (Recomendado)
```bash
# Instalar y configurar automáticamente
curl -fsSL https://raw.githubusercontent.com/alehardmode/rtsp-web-viewer/main/install.sh | bash

# O con wget
wget -qO- https://raw.githubusercontent.com/alehardmode/rtsp-web-viewer/main/install.sh | bash

# O especificar directorio personalizado
curl -fsSL https://raw.githubusercontent.com/alehardmode/rtsp-web-viewer/main/install.sh | bash -s mi-proyecto
```

### 📦 Instalación con npm (Global)
```bash
# Instalar globalmente
npm install -g rtsp-web-viewer

# Configurar y ejecutar
rtsp-web-viewer install
rtsp-web-viewer start
```

### 🛠️ Instalación Manual
```bash
# 1. Clonar repositorio
git clone https://github.com/alehardmode/rtsp-web-viewer.git
cd rtsp-web-viewer

# 2. Ejecutar instalación automática
chmod +x start.sh
./start.sh
```

### 🔧 Instalación Paso a Paso
```bash
# 1. Clonar y navegar
git clone https://github.com/alehardmode/rtsp-web-viewer.git
cd rtsp-web-viewer

# 2. Instalar dependencias
npm install

# 3. Verificar seguridad
npm audit

# 4. Crear directorios necesarios
mkdir -p public/streams logs

# 5. Configurar variables de entorno (opcional)
cp .env.example .env

# 6. Iniciar el servidor
npm start
```

### 🌐 Acceder a la Aplicación
```
http://localhost:3000
```

## 🎮 Uso

### Configuración Básica

1. **Acceder a la interfaz web** en `http://localhost:3000`

2. **Configurar una cámara RTSP:**
   - URL RTSP: `rtsp://usuario:contraseña@ip:puerto/ruta`
   - ID del Stream: Identificador único (ej: `camara-1`)

3. **Ejemplos de URLs RTSP:**
   ```
   rtsp://admin:password@192.168.1.100:554/stream1
   rtsp://admin:admin@192.168.1.50:554/cam/realmonitor?channel=1&subtype=0
   rtsp://user:pass@camera.local:554/live
   ```

### Funciones Principales

#### ▶️ Iniciar Stream
1. Ingresa la URL RTSP de tu cámara
2. Asigna un ID único al stream
3. Haz clic en "🎬 Iniciar Stream"
4. Espera a que el stream se procese (2-5 segundos)

#### 🛑 Detener Stream
- Desde la lista de streams activos
- O usando el botón "🛑 Detener Stream" del stream actual

#### 📺 Visualizar Video
- Haz clic en "📺 Ver" en cualquier stream activo
- El video se reproducirá automáticamente
- Controles de video estándar disponibles

#### ℹ️ Información del Stream
- Clic en "ℹ️ Info" para ver detalles técnicos
- Tiempo de actividad, URLs, estado, etc.

## ⚙️ Configuración Avanzada

### Variables de Entorno

Crear archivo `.env` en la raíz del proyecto:

```env
# Puerto del servidor
PORT=3000

# Configuración FFmpeg
FFMPEG_PATH=/usr/local/bin/ffmpeg
HLS_SEGMENT_TIME=2
HLS_LIST_SIZE=10

# Configuración de streams
MAX_CONCURRENT_STREAMS=10
STREAM_TIMEOUT=30000
```

### Parámetros FFmpeg

Editar `server.js` para ajustar calidad y rendimiento:

```javascript
// Para mejor calidad (más CPU)
'-preset', 'medium',
'-crf', '23',

// Para menor latencia
'-preset', 'ultrafast',
'-tune', 'zerolatency',

// Para menor ancho de banda
'-b:v', '1000k',
'-s', '640x480',
```

## 🔧 Solución de Problemas

### Problemas Comunes

#### ❌ "FFmpeg no encontrado"
```bash
# Verificar instalación
which ffmpeg
ffmpeg -version

# En Windows, verificar PATH
echo %PATH%
```

#### ❌ "Stream no se reproduce"
1. Verificar URL RTSP con VLC o similar
2. Comprobar credenciales de usuario/contraseña
3. Verificar conectividad de red
4. Revisar logs del servidor

#### ❌ "Error de conexión RTSP"
- Verificar que la cámara esté accesible
- Comprobar firewall y puertos
- Validar formato de URL RTSP

#### ❌ "Video se reproduce pero con retraso"
- Ajustar parámetros HLS (hls_time, hls_list_size)
- Usar preset ultrafast en FFmpeg
- Reducir resolución si es necesario

### Logs y Debugging

#### Ver logs del servidor:
```bash
npm start
# Los logs aparecen en la consola
```

#### Logs del navegador:
- Abrir DevTools (F12)
- Pestaña Console para errores JavaScript
- Pestaña Network para problemas de red

### URLs RTSP de Prueba

Para testing, puedes usar streams públicos:

```
# Big Buck Bunny (stream de prueba)
rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mov

# Nota: Los streams públicos pueden no estar siempre disponibles
```

## 🏗️ Arquitectura del Sistema

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Cámara RTSP   │───▶│  Servidor Node  │───▶│  Navegador Web  │
│                 │    │                 │    │                 │
│ Stream RTSP     │    │ FFmpeg → HLS    │    │ HLS Player      │
│ H.264/H.265     │    │ Segmentos .ts   │    │ Video HTML5     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Flujo de Datos

1. **Cliente** solicita iniciar stream RTSP
2. **Servidor** ejecuta FFmpeg para convertir RTSP → HLS
3. **FFmpeg** genera segmentos .ts y playlist .m3u8
4. **Servidor** sirve archivos HLS vía HTTP
5. **Cliente** reproduce HLS con hls.js

## 🔒 Consideraciones de Seguridad

### Recomendaciones

1. **No exponer directamente a internet** sin autenticación
2. **Usar HTTPS** en producción
3. **Validar URLs RTSP** para evitar ataques
4. **Limitar streams concurrentes** para evitar sobrecarga
5. **Implementar autenticación** para acceso web

### Configuración Segura

```javascript
// Ejemplo de validación de URL
const allowedHosts = ['192.168.1.0/24', 'camera.local'];
const isAllowedRTSP = (url) => {
    // Implementar validación personalizada
    return allowedHosts.some(host => url.includes(host));
};
```

## 📈 Optimización de Rendimiento

### Para Múltiples Streams

1. **Usar resoluciones menores** para streams secundarios
2. **Limitar FPS** según necesidades
3. **Configurar calidad adaptativa**
4. **Monitorear uso de CPU/memoria**

### Configuración Optimizada

```javascript
// Configuración para múltiples streams
const streamConfig = {
    primary: {
        resolution: '1920x1080',
        bitrate: '2000k',
        fps: 30
    },
    secondary: {
        resolution: '640x480',
        bitrate: '500k',
        fps: 15
    }
};
```

## 🤝 Contribuir

1. Fork el repositorio
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver archivo `LICENSE` para más detalles.

## 🆘 Soporte

Para soporte técnico:

1. **Issues**: Crear issue en GitHub
2. **Documentación**: Revisar este README
3. **Logs**: Incluir logs del servidor y navegador
4. **Entorno**: Especificar OS, Node.js, FFmpeg versions

## 🚧 Roadmap

### Próximas Funcionalidades

- [ ] Autenticación de usuarios
- [ ] Grabación de streams
- [ ] API REST completa
- [ ] Soporte WebRTC para menor latencia
- [ ] Panel de administración
- [ ] Métricas y analytics
- [ ] Soporte Docker
- [ ] Clustering para escalabilidad

### Versiones

- **v1.0.0**: Funcionalidad básica RTSP → HLS
- **v1.1.0**: Interfaz web mejorada
- **v1.2.0**: Múltiples streams simultáneos
- **v2.0.0**: Autenticación y seguridad (planned)

## 🧪 Probar la Aplicación

### 🎯 Comandos CLI (si instalaste globalmente)
```bash
# Comando principal
rtsp-web-viewer --help

# Inicio rápido
rtsp-web-viewer start

# Demo interactivo
rtsp-web-viewer demo

# Ejecutar pruebas
rtsp-web-viewer test

# Ver estado
rtsp-web-viewer status
```

### 🧪 Pruebas Automáticas
```bash
# Ejecutar suite completa de pruebas
./test.sh

# Ver resultados detallados
cat test-results.log

# O con CLI global
rtsp-web-viewer test
```

### 🎬 Demostración Interactiva
```bash
# Configurar demo con streams de ejemplo
./demo.sh

# O con CLI global
rtsp-web-viewer demo

# Seguir las instrucciones en pantalla
```

### Pruebas Manuales Rápidas

#### 1. Verificar Servidor
```bash
# Verificar que el servidor responde
curl http://localhost:3000

# Verificar API
curl http://localhost:3000/api/streams
```

#### 2. Probar con Stream de Ejemplo
```bash
# Iniciar stream de prueba
curl -X POST http://localhost:3000/api/stream/start \
  -H "Content-Type: application/json" \
  -d '{
    "rtspUrl": "rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mov",
    "streamId": "test-stream"
  }'

# Verificar stream activo
curl http://localhost:3000/api/streams

# Ver en navegador: http://localhost:3000
# Hacer clic en "📺 Ver" para reproducir
```

#### 3. Probar Validación de Seguridad
```bash
# Probar URL inválida (debería fallar)
curl -X POST http://localhost:3000/api/stream/start \
  -H "Content-Type: application/json" \
  -d '{"rtspUrl":"http://invalid.com","streamId":"test"}'

# Respuesta esperada: {"error":"Only RTSP protocol is allowed"}
```

### URLs RTSP de Prueba
Si no tienes cámaras físicas, usa estos streams públicos:
```bash
# Big Buck Bunny (video de prueba)
rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mov

# Sintel Trailer  
rtsp://wowzaec2demo.streamlock.net/vod/mp4:sintel_trailer-480p.mp4
```

### Troubleshooting Rápido
```bash
# Si el servidor no inicia
npm audit fix
npm install

# Si FFmpeg no funciona
which ffmpeg
ffmpeg -version

# Si hay problemas de puerto
PORT=3001 npm start
```

### 📥 Métodos de Instalación Disponibles

| Método | Comando | Descripción |
|--------|---------|-------------|
| **Una línea** | `curl -fsSL https://raw.githubusercontent.com/alehardmode/rtsp-web-viewer/main/install.sh \| bash` | Instalación completamente automática |
| **npm global** | `npm install -g rtsp-web-viewer && rtsp-web-viewer install` | Instalar como comando global |
| **Git clone** | `git clone https://github.com/alehardmode/rtsp-web-viewer.git` | Clonar repositorio manualmente |
| **ZIP download** | Descargar desde GitHub | Descargar archivo ZIP del repositorio |

Para guía completa de pruebas, consulta: **[TESTING_GUIDE.md](TESTING_GUIDE.md)**

---

⭐ **¡Si este proyecto te resulta útil, considera darle una estrella!** ⭐