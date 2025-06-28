#!/bin/bash

# RTSP Web Viewer - Demo Script
# Este script configura una demostración completa con URLs de prueba

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Variables
DEMO_PORT=${PORT:-3000}
DEMO_HOST="localhost"
DEMO_URL="http://${DEMO_HOST}:${DEMO_PORT}"

echo -e "${PURPLE}🎬 RTSP Web Viewer - Demostración Interactiva${NC}"
echo "=============================================="
echo ""

# Función para logging
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que el servidor esté corriendo
check_server() {
    log_info "Verificando servidor en $DEMO_URL..."

    if curl -s "$DEMO_URL" >/dev/null 2>&1; then
        log_success "Servidor está corriendo correctamente"
        return 0
    else
        log_error "Servidor no está respondiendo"
        echo ""
        echo "Por favor inicia el servidor primero:"
        echo "  npm start"
        echo ""
        echo "Luego ejecuta este demo nuevamente:"
        echo "  ./demo.sh"
        exit 1
    fi
}

# URLs RTSP de demostración
setup_demo_streams() {
    log_info "Configurando streams de demostración..."
    echo ""

    # Stream 1: Big Buck Bunny (Video de prueba popular)
    echo -e "${YELLOW}Demo 1: Big Buck Bunny (Video de prueba)${NC}"
    echo "URL: rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mov"
    echo "ID: big-buck-bunny"
    echo ""

    curl -s -X POST "$DEMO_URL/api/stream/start" \
        -H "Content-Type: application/json" \
        -d '{
            "rtspUrl": "rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mov",
            "streamId": "big-buck-bunny"
        }' | python3 -m json.tool 2>/dev/null || echo "Configurando stream..."

    sleep 2

    # Stream 2: Sintel Trailer
    echo -e "${YELLOW}Demo 2: Sintel Trailer${NC}"
    echo "URL: rtsp://wowzaec2demo.streamlock.net/vod/mp4:sintel_trailer-480p.mp4"
    echo "ID: sintel-trailer"
    echo ""

    curl -s -X POST "$DEMO_URL/api/stream/start" \
        -H "Content-Type: application/json" \
        -d '{
            "rtspUrl": "rtsp://wowzaec2demo.streamlock.net/vod/mp4:sintel_trailer-480p.mp4",
            "streamId": "sintel-trailer"
        }' | python3 -m json.tool 2>/dev/null || echo "Configurando stream..."

    sleep 2

    # Stream 3: Test pattern local (si FFmpeg está disponible)
    if command -v ffmpeg >/dev/null 2>&1; then
        echo -e "${YELLOW}Demo 3: Patrón de prueba local${NC}"
        echo "Creando stream de prueba local con FFmpeg..."
        echo ""

        # Crear stream de test pattern en background
        ffmpeg -f lavfi -i testsrc=duration=3600:size=640x480:rate=25 \
               -f lavfi -i sine=frequency=1000:duration=3600 \
               -c:v libx264 -preset ultrafast -tune zerolatency \
               -c:a aac -f rtsp rtsp://localhost:8554/testpattern >/dev/null 2>&1 &

        FFMPEG_PID=$!
        echo "Stream local iniciado (PID: $FFMPEG_PID)"
        sleep 3

        curl -s -X POST "$DEMO_URL/api/stream/start" \
            -H "Content-Type: application/json" \
            -d '{
                "rtspUrl": "rtsp://localhost:8554/testpattern",
                "streamId": "test-pattern"
            }' | python3 -m json.tool 2>/dev/null || echo "Configurando stream local..."
    else
        log_warning "FFmpeg no disponible - saltando demo de stream local"
    fi

    echo ""
    log_success "Streams de demostración configurados"
}

# Mostrar streams activos
show_active_streams() {
    echo ""
    log_info "Verificando streams activos..."
    echo ""

    local streams=$(curl -s "$DEMO_URL/api/streams")
    echo "$streams" | python3 -m json.tool 2>/dev/null || echo "$streams"

    echo ""
    log_info "Streams configurados correctamente"
}

# Instrucciones para el usuario
show_instructions() {
    echo ""
    echo "=============================================="
    echo -e "${GREEN}🎉 ¡DEMOSTRACIÓN LISTA!${NC}"
    echo "=============================================="
    echo ""
    echo "Ahora puedes:"
    echo ""
    echo -e "${BLUE}1.${NC} Abrir tu navegador en: ${YELLOW}$DEMO_URL${NC}"
    echo -e "${BLUE}2.${NC} En la lista de 'Streams Activos', hacer clic en '📺 Ver'"
    echo -e "${BLUE}3.${NC} Disfrutar de los videos de demostración"
    echo ""
    echo "Streams disponibles:"
    echo -e "  • ${YELLOW}big-buck-bunny${NC} - Video de animación clásico"
    echo -e "  • ${YELLOW}sintel-trailer${NC} - Trailer de Blender Foundation"
    if command -v ffmpeg >/dev/null 2>&1; then
        echo -e "  • ${YELLOW}test-pattern${NC} - Patrón de prueba generado localmente"
    fi
    echo ""
    echo "=============================================="
    echo ""
    echo -e "${PURPLE}Funciones a probar:${NC}"
    echo "• Ver videos en tiempo real"
    echo "• Cambiar entre diferentes streams"
    echo "• Detener y reiniciar streams"
    echo "• Ver información detallada de cada stream"
    echo "• Monitorear logs en tiempo real"
    echo ""
    echo -e "${YELLOW}Tip:${NC} Los streams públicos pueden tardar unos segundos en cargar"
    echo -e "${YELLOW}Tip:${NC} Si un stream no funciona, prueba con otro"
    echo ""
}

# Función para limpiar al salir
cleanup() {
    echo ""
    log_info "Limpiando streams de demostración..."

    # Detener streams de demo
    curl -s -X POST "$DEMO_URL/api/stream/stop" \
        -H "Content-Type: application/json" \
        -d '{"streamId": "big-buck-bunny"}' >/dev/null 2>&1 || true

    curl -s -X POST "$DEMO_URL/api/stream/stop" \
        -H "Content-Type: application/json" \
        -d '{"streamId": "sintel-trailer"}' >/dev/null 2>&1 || true

    curl -s -X POST "$DEMO_URL/api/stream/stop" \
        -H "Content-Type: application/json" \
        -d '{"streamId": "test-pattern"}' >/dev/null 2>&1 || true

    # Matar proceso FFmpeg si existe
    if [ ! -z "${FFMPEG_PID:-}" ]; then
        kill $FFMPEG_PID 2>/dev/null || true
        log_info "Stream local detenido"
    fi

    log_success "Cleanup completado"
}

# Menú interactivo
interactive_menu() {
    while true; do
        echo ""
        echo "=============================================="
        echo -e "${PURPLE}MENÚ DE DEMOSTRACIÓN${NC}"
        echo "=============================================="
        echo "1. Configurar streams de demo"
        echo "2. Ver streams activos"
        echo "3. Abrir navegador (si es posible)"
        echo "4. Probar API manualmente"
        echo "5. Ver logs del servidor"
        echo "6. Cleanup y salir"
        echo ""
        read -p "Selecciona una opción (1-6): " choice

        case $choice in
            1)
                setup_demo_streams
                show_active_streams
                show_instructions
                ;;
            2)
                show_active_streams
                ;;
            3)
                log_info "Intentando abrir navegador..."
                if command -v open >/dev/null 2>&1; then
                    open "$DEMO_URL"
                elif command -v xdg-open >/dev/null 2>&1; then
                    xdg-open "$DEMO_URL"
                elif command -v start >/dev/null 2>&1; then
                    start "$DEMO_URL"
                else
                    log_warning "No se pudo abrir automáticamente"
                    echo "Abre manualmente: $DEMO_URL"
                fi
                ;;
            4)
                echo ""
                echo "Ejemplos de API:"
                echo ""
                echo "# Listar streams:"
                echo "curl $DEMO_URL/api/streams"
                echo ""
                echo "# Iniciar nuevo stream:"
                echo 'curl -X POST $DEMO_URL/api/stream/start \'
                echo '  -H "Content-Type: application/json" \'
                echo '  -d '"'"'{"rtspUrl":"rtsp://tu-url","streamId":"mi-stream"}'"'"
                echo ""
                echo "# Detener stream:"
                echo 'curl -X POST $DEMO_URL/api/stream/stop \'
                echo '  -H "Content-Type: application/json" \'
                echo '  -d '"'"'{"streamId":"mi-stream"}'"'"
                echo ""
                ;;
            5)
                echo ""
                log_info "Para ver logs del servidor en tiempo real:"
                echo "tail -f logs/combined.log"
                echo ""
                log_info "O revisar la consola donde ejecutaste 'npm start'"
                ;;
            6)
                cleanup
                echo ""
                log_success "¡Gracias por probar RTSP Web Viewer!"
                echo "Para más información consulta README.md"
                exit 0
                ;;
            *)
                log_error "Opción inválida. Por favor selecciona 1-6."
                ;;
        esac
    done
}

# Función principal
main() {
    # Verificar servidor
    check_server

    echo ""
    echo "Bienvenido a la demostración de RTSP Web Viewer"
    echo ""
    echo "Esta demo configurará automáticamente algunos streams"
    echo "de ejemplo para que puedas probar la aplicación."
    echo ""

    read -p "¿Quieres continuar con la demo automática? (y/N): " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        setup_demo_streams
        show_active_streams
        show_instructions

        echo ""
        read -p "¿Quieres acceder al menú interactivo? (y/N): " -n 1 -r
        echo

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            interactive_menu
        else
            echo ""
            log_info "Demo configurada. ¡Disfruta explorando!"
            echo "Ejecuta './demo.sh' nuevamente para el menú interactivo"
            echo "O ejecuta 'curl $DEMO_URL/api/streams' para ver streams activos"
        fi
    else
        echo ""
        log_info "Demo cancelada. Puedes ejecutar el menú interactivo:"
        interactive_menu
    fi
}

# Trap para cleanup al salir
trap cleanup EXIT

# Ejecutar si se llama directamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
