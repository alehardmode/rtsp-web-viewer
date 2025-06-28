#!/bin/bash

# RTSP Web Viewer - Quick Start Script
# Este script automatiza la configuración inicial del proyecto

set -e

echo "🚀 RTSP Web Viewer - Configuración Inicial"
echo "=========================================="

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: Ejecuta este script desde el directorio raíz del proyecto"
    exit 1
fi

# Función para verificar si un comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Verificar Node.js
echo "🔍 Verificando Node.js..."
if command_exists node; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js encontrado: $NODE_VERSION"

    # Verificar versión mínima (v14)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d. -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -lt 14 ]; then
        echo "⚠️  Advertencia: Se recomienda Node.js v14 o superior"
    fi
else
    echo "❌ Node.js no encontrado. Por favor instala Node.js v14 o superior"
    echo "   Visita: https://nodejs.org/"
    exit 1
fi

# Verificar npm
echo "🔍 Verificando npm..."
if command_exists npm; then
    NPM_VERSION=$(npm --version)
    echo "✅ npm encontrado: v$NPM_VERSION"
else
    echo "❌ npm no encontrado. Instala npm junto con Node.js"
    exit 1
fi

# Verificar FFmpeg
echo "🔍 Verificando FFmpeg..."
if command_exists ffmpeg; then
    FFMPEG_VERSION=$(ffmpeg -version 2>/dev/null | head -n1 | cut -d' ' -f3)
    echo "✅ FFmpeg encontrado: $FFMPEG_VERSION"
else
    echo "❌ FFmpeg no encontrado. Es requerido para la conversión de video"
    echo ""
    echo "Instrucciones de instalación:"

    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "  macOS (con Homebrew):"
        echo "    brew install ffmpeg"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "  Ubuntu/Debian:"
        echo "    sudo apt update && sudo apt install ffmpeg"
        echo "  CentOS/RHEL:"
        echo "    sudo yum install ffmpeg"
    else
        echo "  Windows:"
        echo "    Descarga desde: https://ffmpeg.org/download.html"
        echo "    Agrega FFmpeg al PATH del sistema"
    fi

    echo ""
    read -p "¿Quieres continuar sin FFmpeg? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Instala FFmpeg y vuelve a ejecutar este script"
        exit 1
    fi
    echo "⚠️  Continuando sin FFmpeg. La funcionalidad estará limitada."
fi

# Instalar dependencias
echo ""
echo "📦 Instalando dependencias de Node.js..."
if npm install; then
    echo "✅ Dependencias instaladas correctamente"
else
    echo "❌ Error al instalar dependencias"
    exit 1
fi

# Crear directorios necesarios
echo ""
echo "📁 Creando directorios necesarios..."
mkdir -p public/streams
mkdir -p logs
echo "✅ Directorios creados"

# Crear archivo .env si no existe
echo ""
echo "⚙️  Configurando variables de entorno..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ Archivo .env creado desde .env.example"
        echo "   Puedes editarlo para personalizar la configuración"
    else
        echo "PORT=3000" > .env
        echo "NODE_ENV=development" >> .env
        echo "✅ Archivo .env básico creado"
    fi
else
    echo "✅ Archivo .env ya existe"
fi

# Verificar permisos (en sistemas Unix)
if [[ "$OSTYPE" != "msys" && "$OSTYPE" != "win32" ]]; then
    echo ""
    echo "🔒 Verificando permisos..."
    chmod +x start.sh 2>/dev/null || true
    echo "✅ Permisos configurados"
fi

# Mostrar información final
echo ""
echo "🎉 ¡Configuración completada!"
echo "=============================="
echo ""
echo "Para iniciar la aplicación:"
echo "  Desarrollo:  npm run dev"
echo "  Producción:  npm start"
echo ""
echo "Luego abre tu navegador en:"
echo "  http://localhost:3000"
echo ""
echo "📋 URLs RTSP de ejemplo:"
echo "  rtsp://admin:password@192.168.1.100:554/stream1"
echo "  rtsp://user:pass@camera.local:554/live"
echo ""
echo "📚 Para más información, consulta README.md"
echo ""

# Preguntar si iniciar automáticamente
read -p "¿Quieres iniciar el servidor ahora? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🚀 Iniciando servidor..."
    echo "   Presiona Ctrl+C para detener"
    echo ""

    # Detectar si nodemon está disponible
    if command_exists nodemon && [ -f "node_modules/.bin/nodemon" ]; then
        npm run dev
    else
        npm start
    fi
else
    echo ""
    echo "✨ Todo listo. Ejecuta 'npm start' cuando quieras iniciar el servidor."
fi
