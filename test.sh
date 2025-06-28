#!/bin/bash

# RTSP Web Viewer - Automated Test Script
# Este script ejecuta pruebas automáticas para verificar el funcionamiento de la aplicación

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
TEST_PORT=${PORT:-3000}
TEST_HOST="localhost"
TEST_URL="http://${TEST_HOST}:${TEST_PORT}"
LOG_FILE="test-results.log"
FAILED_TESTS=0
TOTAL_TESTS=0

# Función para logging
log_test() {
    echo -e "${BLUE}[TEST]${NC} $1" | tee -a "$LOG_FILE"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1" | tee -a "$LOG_FILE"
    FAILED_TESTS=$((FAILED_TESTS + 1))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

# Función para verificar dependencias
check_dependencies() {
    log_info "Verificando dependencias del sistema..."

    # Node.js
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION=$(node --version)
        log_success "Node.js encontrado: $NODE_VERSION"
    else
        log_error "Node.js no encontrado"
        return 1
    fi

    # npm
    if command -v npm >/dev/null 2>&1; then
        NPM_VERSION=$(npm --version)
        log_success "npm encontrado: v$NPM_VERSION"
    else
        log_error "npm no encontrado"
        return 1
    fi

    # FFmpeg
    if command -v ffmpeg >/dev/null 2>&1; then
        FFMPEG_VERSION=$(ffmpeg -version 2>/dev/null | head -n1 | cut -d' ' -f3)
        log_success "FFmpeg encontrado: $FFMPEG_VERSION"
    else
        log_warning "FFmpeg no encontrado - funcionalidad limitada"
    fi

    # curl
    if command -v curl >/dev/null 2>&1; then
        log_success "curl disponible para pruebas"
    else
        log_error "curl no encontrado - requerido para pruebas"
        return 1
    fi
}

# Función para verificar archivos del proyecto
check_project_files() {
    log_info "Verificando archivos del proyecto..."

    local required_files=("package.json" "server.js" "public/index.html" "public/css/style.css" "public/js/app.js")

    for file in "${required_files[@]}"; do
        if [ -f "$file" ]; then
            log_success "Archivo encontrado: $file"
        else
            log_error "Archivo faltante: $file"
        fi
    done

    # Verificar directorios
    local required_dirs=("public" "public/css" "public/js")

    for dir in "${required_dirs[@]}"; do
        if [ -d "$dir" ]; then
            log_success "Directorio encontrado: $dir"
        else
            log_error "Directorio faltante: $dir"
        fi
    done
}

# Función para verificar dependencias npm
check_npm_dependencies() {
    log_info "Verificando dependencias de npm..."

    if [ -f "package.json" ]; then
        log_success "package.json encontrado"

        if [ -d "node_modules" ]; then
            log_success "node_modules existe"

            # Verificar audit
            if npm audit --audit-level high >/dev/null 2>&1; then
                log_success "npm audit: sin vulnerabilidades críticas"
            else
                log_warning "npm audit: se encontraron vulnerabilidades"
            fi
        else
            log_warning "node_modules no existe - ejecutar 'npm install'"
        fi
    else
        log_error "package.json no encontrado"
    fi
}

# Función para esperar a que el servidor esté listo
wait_for_server() {
    log_info "Esperando a que el servidor esté listo..."
    local timeout=30
    local count=0

    while [ $count -lt $timeout ]; do
        if curl -s "$TEST_URL" >/dev/null 2>&1; then
            log_success "Servidor respondiendo en $TEST_URL"
            return 0
        fi
        sleep 1
        count=$((count + 1))
        echo -n "."
    done

    echo ""
    log_error "Timeout esperando servidor después de ${timeout}s"
    return 1
}

# Función para probar servidor web básico
test_web_server() {
    log_test "Probando servidor web básico"

    # Test HTTP response
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$TEST_URL")
    if [ "$response" = "200" ]; then
        log_success "Servidor web responde con HTTP 200"
    else
        log_error "Servidor web responde con HTTP $response"
    fi

    # Test content type
    local content_type=$(curl -s -I "$TEST_URL" | grep -i "content-type" | cut -d: -f2 | tr -d ' \r')
    if [[ "$content_type" == *"text/html"* ]]; then
        log_success "Content-Type correcto: $content_type"
    else
        log_error "Content-Type incorrecto: $content_type"
    fi
}

# Función para probar API REST
test_api_endpoints() {
    log_test "Probando endpoints de API"

    # Test GET /api/streams
    local streams_response=$(curl -s "$TEST_URL/api/streams")
    if echo "$streams_response" | grep -q '"streams"'; then
        log_success "GET /api/streams responde correctamente"
    else
        log_error "GET /api/streams respuesta inválida: $streams_response"
    fi

    # Test POST /api/stream/start con datos inválidos
    local invalid_response=$(curl -s -X POST "$TEST_URL/api/stream/start" \
        -H "Content-Type: application/json" \
        -d '{"rtspUrl":"http://invalid.com","streamId":"test"}')

    if echo "$invalid_response" | grep -q '"error"'; then
        log_success "Validación de entrada funciona correctamente"
    else
        log_error "Validación de entrada falló: $invalid_response"
    fi

    # Test 404 endpoint
    local not_found=$(curl -s -o /dev/null -w "%{http_code}" "$TEST_URL/api/nonexistent")
    if [ "$not_found" = "404" ]; then
        log_success "Endpoints inexistentes retornan 404"
    else
        log_error "Endpoint inexistente retorna $not_found en lugar de 404"
    fi
}

# Función para probar headers de seguridad
test_security_headers() {
    log_test "Probando headers de seguridad"

    local headers=$(curl -s -I "$TEST_URL")

    # X-Frame-Options
    if echo "$headers" | grep -i "x-frame-options" >/dev/null; then
        log_success "X-Frame-Options header presente"
    else
        log_warning "X-Frame-Options header faltante"
    fi

    # X-Content-Type-Options
    if echo "$headers" | grep -i "x-content-type-options" >/dev/null; then
        log_success "X-Content-Type-Options header presente"
    else
        log_warning "X-Content-Type-Options header faltante"
    fi

    # Content-Security-Policy
    if echo "$headers" | grep -i "content-security-policy" >/dev/null; then
        log_success "Content-Security-Policy header presente"
    else
        log_warning "Content-Security-Policy header faltante"
    fi
}

# Función para probar rate limiting
test_rate_limiting() {
    log_test "Probando rate limiting"

    local requests_sent=0
    local rate_limited=false

    # Enviar múltiples requests rápidamente
    for i in {1..15}; do
        local response_code=$(curl -s -o /dev/null -w "%{http_code}" "$TEST_URL/api/streams")
        requests_sent=$((requests_sent + 1))

        if [ "$response_code" = "429" ]; then
            rate_limited=true
            break
        fi

        # Pequeña pausa para no saturar
        sleep 0.1
    done

    if [ "$rate_limited" = true ]; then
        log_success "Rate limiting funciona (activado después de $requests_sent requests)"
    else
        log_warning "Rate limiting no activado en $requests_sent requests"
    fi
}

# Función para probar validación de entrada
test_input_validation() {
    log_test "Probando validación de entrada"

    # URL no RTSP
    local http_test=$(curl -s -X POST "$TEST_URL/api/stream/start" \
        -H "Content-Type: application/json" \
        -d '{"rtspUrl":"http://example.com","streamId":"test"}')

    if echo "$http_test" | grep -q "Only RTSP protocol"; then
        log_success "Validación de protocolo RTSP funciona"
    else
        log_error "Validación de protocolo RTSP falló"
    fi

    # URL localhost
    local localhost_test=$(curl -s -X POST "$TEST_URL/api/stream/start" \
        -H "Content-Type: application/json" \
        -d '{"rtspUrl":"rtsp://localhost:554/stream","streamId":"test"}')

    if echo "$localhost_test" | grep -q "Localhost URLs are not allowed"; then
        log_success "Validación anti-localhost funciona"
    else
        log_error "Validación anti-localhost falló"
    fi

    # Stream ID inválido
    local invalid_id_test=$(curl -s -X POST "$TEST_URL/api/stream/start" \
        -H "Content-Type: application/json" \
        -d '{"rtspUrl":"rtsp://demo.com:554/stream","streamId":"test@invalid#"}')

    if echo "$invalid_id_test" | grep -q "alphanumeric"; then
        log_success "Validación de Stream ID funciona"
    else
        log_error "Validación de Stream ID falló"
    fi
}

# Función para probar archivos estáticos
test_static_files() {
    log_test "Probando archivos estáticos"

    local static_files=("css/style.css" "js/app.js")

    for file in "${static_files[@]}"; do
        local response=$(curl -s -o /dev/null -w "%{http_code}" "$TEST_URL/$file")
        if [ "$response" = "200" ]; then
            log_success "Archivo estático accesible: $file"
        else
            log_error "Archivo estático no accesible: $file (HTTP $response)"
        fi
    done
}

# Función para generar reporte
generate_report() {
    echo ""
    echo "============================================"
    echo "         REPORTE DE PRUEBAS"
    echo "============================================"
    echo "Total de pruebas: $TOTAL_TESTS"
    echo "Pruebas exitosas: $((TOTAL_TESTS - FAILED_TESTS))"
    echo "Pruebas fallidas: $FAILED_TESTS"

    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}✅ TODAS LAS PRUEBAS PASARON${NC}"
        echo "Estado: LISTO PARA PRODUCCIÓN"
        echo ""
        echo "Próximos pasos:"
        echo "1. Configurar cámaras RTSP reales"
        echo "2. Probar con streams en vivo"
        echo "3. Configurar para producción (HTTPS, reverse proxy)"
    else
        echo -e "${RED}❌ $FAILED_TESTS PRUEBAS FALLARON${NC}"
        echo "Estado: REQUIERE ATENCIÓN"
        echo ""
        echo "Revisa los errores arriba y:"
        echo "1. Verifica dependencias faltantes"
        echo "2. Revisa configuración del servidor"
        echo "3. Consulta TROUBLESHOOTING.md"
    fi

    echo ""
    echo "Log completo guardado en: $LOG_FILE"
    echo "============================================"
}

# Función principal
main() {
    echo "🧪 RTSP Web Viewer - Suite de Pruebas Automatizadas"
    echo "===================================================="
    echo ""

    # Limpiar log anterior
    echo "Iniciando pruebas $(date)" > "$LOG_FILE"

    # Verificar dependencias del sistema
    check_dependencies || { log_error "Dependencias faltantes"; exit 1; }

    # Verificar archivos del proyecto
    check_project_files

    # Verificar dependencias npm
    check_npm_dependencies

    # Verificar si el servidor ya está corriendo
    if curl -s "$TEST_URL" >/dev/null 2>&1; then
        log_info "Servidor ya está corriendo en $TEST_URL"
    else
        log_warning "Servidor no está corriendo. Inicia con 'npm start' en otra terminal"
        log_info "Esperando 10 segundos para que inicies el servidor..."
        sleep 10

        if ! wait_for_server; then
            log_error "No se puede conectar al servidor"
            log_info "Por favor inicia el servidor con 'npm start' y vuelve a ejecutar las pruebas"
            exit 1
        fi
    fi

    # Ejecutar pruebas
    test_web_server
    test_api_endpoints
    test_security_headers
    test_static_files
    test_input_validation
    test_rate_limiting

    # Generar reporte final
    generate_report

    # Exit code basado en resultados
    if [ $FAILED_TESTS -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# Verificar si se ejecuta directamente
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
