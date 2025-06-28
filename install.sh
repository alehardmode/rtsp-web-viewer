#!/bin/bash

# RTSP Web Viewer - One-Line Installer
# Copyright (c) 2024 Alejandro (alehardmode)
# Licensed under MIT License

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/alehardmode/rtsp-web-viewer"
PROJECT_NAME="rtsp-web-viewer"
MIN_NODE_VERSION="14"

# Banner
echo -e "${PURPLE}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║               📹 RTSP Web Viewer Installer               ║"
echo "║          One-line installation and setup script         ║"
echo "║                                                          ║"
echo "║  Repository: github.com/alehardmode/rtsp-web-viewer      ║"
echo "║  Author: Alejandro (alehardmode)                         ║"
echo "║  License: MIT                                            ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

check_node_version() {
    if command_exists node; then
        local node_version=$(node --version | sed 's/v//' | cut -d. -f1)
        if [ "$node_version" -ge "$MIN_NODE_VERSION" ]; then
            return 0
        else
            return 1
        fi
    else
        return 1
    fi
}

install_dependencies() {
    log_info "Checking system dependencies..."

    # Check Node.js
    if check_node_version; then
        local node_version=$(node --version)
        log_success "Node.js found: $node_version"
    else
        log_error "Node.js v$MIN_NODE_VERSION+ is required"
        echo ""
        echo "Please install Node.js from: https://nodejs.org/"
        echo "Or use a package manager:"
        echo ""
        if [[ "$OSTYPE" == "darwin"* ]]; then
            echo "  macOS (Homebrew): brew install node"
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            echo "  Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
            echo "  CentOS/RHEL: sudo dnf install nodejs npm"
        fi
        echo ""
        exit 1
    fi

    # Check npm
    if command_exists npm; then
        local npm_version=$(npm --version)
        log_success "npm found: v$npm_version"
    else
        log_error "npm is required but not found"
        exit 1
    fi

    # Check FFmpeg
    if command_exists ffmpeg; then
        local ffmpeg_version=$(ffmpeg -version 2>/dev/null | head -n1 | cut -d' ' -f3)
        log_success "FFmpeg found: $ffmpeg_version"
    else
        log_warning "FFmpeg not found - required for video streaming"
        echo ""
        echo "Install FFmpeg:"
        if [[ "$OSTYPE" == "darwin"* ]]; then
            echo "  macOS: brew install ffmpeg"
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            echo "  Ubuntu/Debian: sudo apt update && sudo apt install ffmpeg"
            echo "  CentOS/RHEL: sudo dnf install ffmpeg"
        elif [[ "$OSTYPE" == "msys" ]]; then
            echo "  Windows: Download from https://ffmpeg.org/download.html"
        fi
        echo ""
        read -p "Continue without FFmpeg? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Install FFmpeg and run this script again"
            exit 1
        fi
    fi

    # Check Git
    if ! command_exists git; then
        log_error "Git is required but not found"
        echo "Please install Git from: https://git-scm.com/"
        exit 1
    fi
}

download_project() {
    log_info "Downloading RTSP Web Viewer..."

    # Default installation directory
    local install_dir="${PROJECT_NAME}"

    # Check if custom directory was provided
    if [ ! -z "$1" ]; then
        install_dir="$1"
    fi

    # Check if directory already exists
    if [ -d "$install_dir" ]; then
        log_warning "Directory '$install_dir' already exists"
        read -p "Remove existing directory? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf "$install_dir"
            log_info "Removed existing directory"
        else
            log_error "Installation cancelled"
            exit 1
        fi
    fi

    # Clone repository
    log_info "Cloning repository to $install_dir..."
    if git clone "$REPO_URL.git" "$install_dir" 2>/dev/null; then
        log_success "Repository cloned successfully"
    else
        log_warning "Git clone failed, trying direct download..."

        # Fallback: Download as ZIP using curl
        if command_exists curl; then
            log_info "Downloading project as ZIP archive..."
            mkdir -p "$install_dir"
            if curl -L "$REPO_URL/archive/refs/heads/main.zip" -o "$install_dir/project.zip" 2>/dev/null; then
                cd "$install_dir"
                if command_exists unzip; then
                    unzip -q project.zip
                    mv rtsp-web-viewer-main/* .
                    mv rtsp-web-viewer-main/.* . 2>/dev/null || true
                    rm -rf rtsp-web-viewer-main project.zip
                    log_success "Project downloaded and extracted successfully"
                else
                    log_error "unzip command not found. Please install unzip or use git clone"
                    exit 1
                fi
            else
                log_error "Failed to download project archive"
                exit 1
            fi
        else
            log_error "Neither git nor curl available. Please install one of them"
            log_error "Git: https://git-scm.com/"
            log_error "Curl: typically pre-installed or available via package manager"
            exit 1
        fi
    fi

    # Change to project directory
    if cd "$install_dir"; then
        log_success "Changed to project directory"
    else
        log_error "Failed to change to project directory"
        exit 1
    fi
}

install_npm_dependencies() {
    log_info "Installing Node.js dependencies..."

    if npm install; then
        log_success "Dependencies installed successfully"
    else
        log_error "Failed to install dependencies"
        exit 1
    fi

    # Run security audit
    log_info "Running security audit..."
    if npm audit; then
        log_success "No security vulnerabilities found"
    else
        log_warning "Security audit completed with warnings"
    fi
}

setup_configuration() {
    log_info "Setting up configuration..."

    # Create .env file if it doesn't exist
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            log_success "Created .env file from template"
        else
            cat > .env << EOF
PORT=3000
NODE_ENV=development
MAX_CONCURRENT_STREAMS=5
STREAM_TIMEOUT=300000
EOF
            log_success "Created basic .env file"
        fi
    fi

    # Create necessary directories
    mkdir -p public/streams logs
    log_success "Created required directories"

    # Set executable permissions
    chmod +x start.sh test.sh demo.sh 2>/dev/null || true
    log_success "Set executable permissions"
}

run_tests() {
    log_info "Running basic tests..."

    # Check if server starts
    if node -c server.js; then
        log_success "Server syntax validation passed"
    else
        log_error "Server syntax validation failed"
        return 1
    fi

    # Run test suite if available
    if [ -f "test.sh" ]; then
        log_info "Running automated test suite..."
        if timeout 60 ./test.sh >/dev/null 2>&1; then
            log_success "Test suite passed"
        else
            log_warning "Some tests may have failed (this is normal without running server)"
        fi
    fi
}

show_completion_message() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    🎉 INSTALLATION COMPLETE!            ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}📁 Project installed in:${NC} $(pwd)"
    echo ""
    echo -e "${YELLOW}🚀 Quick Start:${NC}"
    echo "  1. cd $(basename $(pwd))"
    echo "  2. npm start"
    echo "  3. Open http://localhost:3000"
    echo ""
    echo -e "${YELLOW}🧪 Try the demo:${NC}"
    echo "  ./demo.sh"
    echo ""
    echo -e "${YELLOW}🔧 Run tests:${NC}"
    echo "  ./test.sh"
    echo ""
    echo -e "${YELLOW}📚 Documentation:${NC}"
    echo "  • README.md - Complete documentation"
    echo "  • TESTING_GUIDE.md - Testing instructions"
    echo "  • SECURITY.md - Security guidelines"
    echo "  • CAMERAS.md - Camera configuration"
    echo ""
    echo -e "${YELLOW}🌐 Repository:${NC} $REPO_URL"
    echo ""
    echo -e "${GREEN}Happy streaming! 📹${NC}"
}

# Handle interruption
cleanup() {
    echo ""
    log_warning "Installation interrupted"
    exit 1
}

trap cleanup INT

# Main installation flow
main() {
    local target_dir="$1"

    # Check dependencies
    install_dependencies

    # Download project
    download_project "$target_dir"

    # Install npm dependencies
    install_npm_dependencies

    # Setup configuration
    setup_configuration

    # Run tests
    run_tests

    # Show completion message
    show_completion_message
}

# Parse command line arguments
print_usage() {
    echo "Usage: $0 [directory]"
    echo ""
    echo "Options:"
    echo "  directory    Target directory for installation (default: rtsp-web-viewer)"
    echo ""
    echo "Examples:"
    echo "  $0                    # Install to ./rtsp-web-viewer"
    echo "  $0 my-project        # Install to ./my-project"
    echo ""
}

# Check for help flag
if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
    print_usage
    exit 0
fi

# Start installation
log_info "Starting RTSP Web Viewer installation..."
echo ""

# Pass the first argument if provided
if [ $# -gt 0 ]; then
    main "$1"
else
    main
fi
