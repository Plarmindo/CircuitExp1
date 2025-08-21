#!/bin/bash

# Circuit Explorer Production Deployment Script
# Usage: ./deploy-production.sh [environment] [version]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT="${1:-production}"
VERSION="${2:-$(date +%Y%m%d-%H%M%S)}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        error "npm is not installed"
    fi
    
    # Check electron-builder
    if ! npm list -g electron-builder &> /dev/null; then
        warn "electron-builder not found globally, installing..."
        npm install -g electron-builder
    fi
    
    # Check environment variables
    if [[ "$ENVIRONMENT" == "production" ]]; then
        if [[ -z "${CERTIFICATE_PASSWORD:-}" ]]; then
            error "CERTIFICATE_PASSWORD environment variable is required for production"
        fi
    fi
    
    log "Prerequisites check completed"
}

# Setup environment
setup_environment() {
    log "Setting up environment for $ENVIRONMENT..."
    
    cd "$PROJECT_ROOT"
    
    # Install dependencies
    log "Installing dependencies..."
    npm ci --production=false
    
    # Set production environment
    export NODE_ENV=production
    export ELECTRON_IS_DEV=0
    
    # Create build directory
    mkdir -p dist
    
    log "Environment setup completed"
}

# Run security checks
run_security_checks() {
    log "Running security checks..."
    
    # Check for security vulnerabilities
    log "Checking for security vulnerabilities..."
    npm audit --audit-level=high
    
    # Run security tests
    log "Running security test suite..."
    npm run test:security
    
    log "Security checks completed"
}

# Build application
build_application() {
    log "Building application..."
    
    cd "$PROJECT_ROOT"
    
    # Build web assets
    npm run build
    
    # Build electron application
    case "$(uname -s)" in
        Darwin*)
            log "Building for macOS..."
            npm run electron:build:mac
            ;;
        Linux*)
            log "Building for Linux..."
            npm run electron:build:linux
            ;;
        CYGWIN*|MINGW32*|MSYS*|MINGW*)
            log "Building for Windows..."
            npm run electron:build:win
            ;;
        *)
            error "Unsupported operating system"
            ;;
    esac
    
    log "Application build completed"
}

# Sign application
sign_application() {
    log "Signing application..."
    
    cd "$PROJECT_ROOT"
    
    case "$(uname -s)" in
        Darwin*)
            if [[ -n "${APPLE_CERTIFICATE:-}" ]]; then
                log "Signing macOS application..."
                security import <(echo "$APPLE_CERTIFICATE" | base64 -d) -k ~/Library/Keychains/login.keychain-db -P "$CERTIFICATE_PASSWORD" -T /usr/bin/codesign
                codesign --force --options runtime --sign "Developer ID Application" dist/mac/CircuitExplorer.app
            else
                warn "APPLE_CERTIFICATE not provided, skipping macOS signing"
            fi
            ;;
        Linux*)
            if [[ -n "${GPG_PRIVATE_KEY:-}" ]]; then
                log "Signing Linux application..."
                echo "$GPG_PRIVATE_KEY" | gpg --import
                gpg --armor --detach-sign dist/CircuitExplorer.AppImage
            else
                warn "GPG_PRIVATE_KEY not provided, skipping Linux signing"
            fi
            ;;
        CYGWIN*|MINGW32*|MSYS*|MINGW*)
            if [[ -n "${WINDOWS_CERTIFICATE:-}" ]]; then
                log "Signing Windows application..."
                echo "$WINDOWS_CERTIFICATE" | base64 -d > certificate.pfx
                signtool sign /f certificate.pfx /p "$CERTIFICATE_PASSWORD" /tr http://timestamp.digicert.com /td sha256 /fd sha256 "dist/CircuitExplorer Setup.exe"
                rm certificate.pfx
            else
                warn "WINDOWS_CERTIFICATE not provided, skipping Windows signing"
            fi
            ;;
    esac
    
    log "Application signing completed"
}

# Run tests
run_tests() {
    log "Running tests..."
    
    cd "$PROJECT_ROOT"
    
    # Run unit tests
    log "Running unit tests..."
    npm run test:unit
    
    # Run integration tests
    log "Running integration tests..."
    npm run test:integration
    
    # Run end-to-end tests
    log "Running end-to-end tests..."
    npm run test:e2e
    
    log "All tests completed"
}

# Create deployment package
create_deployment_package() {
    log "Creating deployment package..."
    
    cd "$PROJECT_ROOT"
    
    # Create package directory
    PACKAGE_DIR="dist/deployment-$VERSION"
    mkdir -p "$PACKAGE_DIR"
    
    # Copy built application
    cp -r dist/* "$PACKAGE_DIR/"
    
    # Copy configuration files
    cp PRODUCTION_DEPLOYMENT.md "$PACKAGE_DIR/"
    cp package.json "$PACKAGE_DIR/"
    
    # Create checksums
    cd "$PACKAGE_DIR"
    find . -type f -exec sha256sum {} \; > checksums.txt
    
    # Create tarball
    cd "$PROJECT_ROOT"
    tar -czf "circuit-explorer-$VERSION-$ENVIRONMENT.tar.gz" -C dist "deployment-$VERSION"
    
    log "Deployment package created: circuit-explorer-$VERSION-$ENVIRONMENT.tar.gz"
}

# Deploy to staging
deploy_staging() {
    log "Deploying to staging environment..."
    
    # Upload to staging server
    if [[ -n "${STAGING_SERVER:-}" ]]; then
        scp "circuit-explorer-$VERSION-$ENVIRONMENT.tar.gz" "$STAGING_SERVER:/tmp/"
        ssh "$STAGING_SERVER" "cd /tmp && tar -xzf circuit-explorer-$VERSION-$ENVIRONMENT.tar.gz && sudo ./install.sh"
    else
        warn "STAGING_SERVER not configured, skipping staging deployment"
    fi
    
    log "Staging deployment completed"
}

# Deploy to production
deploy_production() {
    log "Deploying to production environment..."
    
    # Confirm deployment
    read -p "Are you sure you want to deploy to production? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        error "Production deployment cancelled"
    fi
    
    # Upload to production server
    if [[ -n "${PRODUCTION_SERVER:-}" ]]; then
        scp "circuit-explorer-$VERSION-$ENVIRONMENT.tar.gz" "$PRODUCTION_SERVER:/tmp/"
        ssh "$PRODUCTION_SERVER" "cd /tmp && tar -xzf circuit-explorer-$VERSION-$ENVIRONMENT.tar.gz && sudo ./install.sh"
    else
        warn "PRODUCTION_SERVER not configured, skipping production deployment"
    fi
    
    log "Production deployment completed"
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Check if application starts
    cd "$PROJECT_ROOT"
    timeout 30s npm run start:prod || error "Application failed to start"
    
    # Check monitoring endpoints
    if command -v curl &> /dev/null; then
        curl -f http://localhost:3000/health || error "Health check endpoint failed"
    fi
    
    log "Health check completed"
}

# Cleanup
cleanup() {
    log "Cleaning up..."
    
    cd "$PROJECT_ROOT"
    rm -f certificate.pfx
    rm -rf dist/deployment-*
    
    log "Cleanup completed"
}

# Main deployment flow
main() {
    log "Starting Circuit Explorer deployment (version: $VERSION, environment: $ENVIRONMENT)"
    
    check_prerequisites
    setup_environment
    run_security_checks
    build_application
    sign_application
    run_tests
    create_deployment_package
    
    case "$ENVIRONMENT" in
        staging)
            deploy_staging
            ;;
        production)
            deploy_production
            ;;
        package-only)
            log "Package-only mode, skipping deployment"
            ;;
        *)
            error "Unknown environment: $ENVIRONMENT"
            ;;
    esac
    
    health_check
    cleanup
    
    log "Deployment completed successfully!"
    log "Package: circuit-explorer-$VERSION-$ENVIRONMENT.tar.gz"
}

# Handle script interruption
trap cleanup EXIT

# Run main function
main "$@"