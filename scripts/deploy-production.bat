@echo off
REM Circuit Explorer Production Deployment Script for Windows
REM Usage: deploy-production.bat [environment] [version]

setlocal enabledelayedexpansion

REM Configuration
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."
set "ENVIRONMENT=%~1"
set "VERSION=%~2"

REM Default values
if "%ENVIRONMENT%"=="" set "ENVIRONMENT=production"
if "%VERSION%"=="" set "VERSION=%date:~-4%%date:~4,2%%date:~7,2%-%time:~0,2%%time:~3,2%%time:~6,2%"

REM Colors
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "NC=[0m"

REM Logging function
:log
    echo %GREEN%[%date% %time%] %~1%NC%
    goto :eof

REM Warning function
:warn
    echo %YELLOW%[%date% %time%] WARNING: %~1%NC%
    goto :eof

REM Error function
:error
    echo %RED%[%date% %time%] ERROR: %~1%NC%
    exit /b 1

REM Check prerequisites
:check_prerequisites
    call :log "Checking prerequisites..."
    
    REM Check Node.js
    node --version >nul 2>&1 || call :error "Node.js is not installed"
    
    REM Check npm
    npm --version >nul 2>&1 || call :error "npm is not installed"
    
    REM Check electron-builder
    npm list -g electron-builder >nul 2>&1 || (
        call :warn "electron-builder not found globally, installing..."
        npm install -g electron-builder
    )
    
    REM Check environment variables
    if "%ENVIRONMENT%"=="production" (
        if "%CERTIFICATE_PASSWORD%"=="" (
            call :error "CERTIFICATE_PASSWORD environment variable is required for production"
        )
    )
    
    call :log "Prerequisites check completed"
    goto :eof

REM Setup environment
:setup_environment
    call :log "Setting up environment for %ENVIRONMENT%..."
    
    cd /d "%PROJECT_ROOT%"
    
    REM Install dependencies
    call :log "Installing dependencies..."
    npm ci --production=false
    
    REM Set production environment
    set "NODE_ENV=production"
    set "ELECTRON_IS_DEV=0"
    
    REM Create build directory
    if not exist "dist" mkdir "dist"
    
    call :log "Environment setup completed"
    goto :eof

REM Run security checks
:run_security_checks
    call :log "Running security checks..."
    
    REM Check for security vulnerabilities
    call :log "Checking for security vulnerabilities..."
    npm audit --audit-level=high
    
    REM Run security tests
    call :log "Running security test suite..."
    npm run test:security
    
    call :log "Security checks completed"
    goto :eof

REM Build application
:build_application
    call :log "Building application..."
    
    cd /d "%PROJECT_ROOT%"
    
    REM Build web assets
    npm run build
    
    REM Build electron application
    if exist "dist\win-unpacked" rmdir /s /q "dist\win-unpacked"
    npm run electron:build:win
    
    call :log "Application build completed"
    goto :eof

REM Sign application
:sign_application
    call :log "Signing application..."
    
    cd /d "%PROJECT_ROOT%"
    
    if "%WINDOWS_CERTIFICATE%"=="" (
        call :warn "WINDOWS_CERTIFICATE not provided, skipping Windows signing"
        goto :eof
    )
    
    REM Decode certificate
    echo %WINDOWS_CERTIFICATE% > certificate.b64
    certutil -decode certificate.b64 certificate.pfx
    
    REM Sign application
    signtool sign /f certificate.pfx /p "%CERTIFICATE_PASSWORD%" /tr http://timestamp.digicert.com /td sha256 /fd sha256 "dist\CircuitExplorer Setup.exe"
    
    REM Cleanup certificate
    del certificate.pfx
    del certificate.b64
    
    call :log "Application signing completed"
    goto :eof

REM Run tests
:run_tests
    call :log "Running tests..."
    
    cd /d "%PROJECT_ROOT%"
    
    REM Run unit tests
    call :log "Running unit tests..."
    npm run test:unit
    
    REM Run integration tests
    call :log "Running integration tests..."
    npm run test:integration
    
    REM Run end-to-end tests
    call :log "Running end-to-end tests..."
    npm run test:e2e
    
    call :log "All tests completed"
    goto :eof

REM Create deployment package
:create_deployment_package
    call :log "Creating deployment package..."
    
    cd /d "%PROJECT_ROOT%"
    
    REM Create package directory
    set "PACKAGE_DIR=dist\deployment-%VERSION%"
    if exist "%PACKAGE_DIR%" rmdir /s /q "%PACKAGE_DIR%"
    mkdir "%PACKAGE_DIR%"
    
    REM Copy built application
    xcopy "dist\*" "%PACKAGE_DIR%\" /E /I /H /Y
    
    REM Copy configuration files
    copy "PRODUCTION_DEPLOYMENT.md" "%PACKAGE_DIR%\" >nul
    copy "package.json" "%PACKAGE_DIR%\" >nul
    
    REM Create checksums
    cd "%PACKAGE_DIR%"
    for %%f in (*) do (
        certutil -hashfile "%%f" SHA256 >> checksums.txt
    )
    
    REM Create zip
    cd "%PROJECT_ROOT%"
    powershell -Command "Compress-Archive -Path 'dist\deployment-%VERSION%\*' -DestinationPath 'circuit-explorer-%VERSION%-%ENVIRONMENT%.zip'"
    
    call :log "Deployment package created: circuit-explorer-%VERSION%-%ENVIRONMENT%.zip"
    goto :eof

REM Deploy to staging
:deploy_staging
    call :log "Deploying to staging environment..."
    
    if "%STAGING_SERVER%"=="" (
        call :warn "STAGING_SERVER not configured, skipping staging deployment"
        goto :eof
    )
    
    REM Upload to staging server
    scp "circuit-explorer-%VERSION%-%ENVIRONMENT%.zip" "%STAGING_SERVER%:/tmp/"
    ssh "%STAGING_SERVER%" "cd /tmp && unzip circuit-explorer-%VERSION%-%ENVIRONMENT%.zip && .\install.bat"
    
    call :log "Staging deployment completed"
    goto :eof

REM Deploy to production
:deploy_production
    call :log "Deploying to production environment..."
    
    REM Confirm deployment
    set /p confirm=Are you sure you want to deploy to production? (yes/no): 
    if /i not "%confirm%"=="yes" (
        call :error "Production deployment cancelled"
    )
    
    if "%PRODUCTION_SERVER%"=="" (
        call :warn "PRODUCTION_SERVER not configured, skipping production deployment"
        goto :eof
    )
    
    REM Upload to production server
    scp "circuit-explorer-%VERSION%-%ENVIRONMENT%.zip" "%PRODUCTION_SERVER%:/tmp/"
    ssh "%PRODUCTION_SERVER%" "cd /tmp && unzip circuit-explorer-%VERSION%-%ENVIRONMENT%.zip && .\install.bat"
    
    call :log "Production deployment completed"
    goto :eof

REM Health check
:health_check
    call :log "Performing health check..."
    
    cd /d "%PROJECT_ROOT%"
    
    REM Check if application starts
    timeout /t 30 /nobreak >nul
    
    REM Check monitoring endpoints
    powershell -Command "Invoke-WebRequest -Uri 'http://localhost:3000/health' -UseBasicParsing"
    if errorlevel 1 call :error "Health check endpoint failed"
    
    call :log "Health check completed"
    goto :eof

REM Cleanup
:cleanup
    call :log "Cleaning up..."
    
    cd /d "%PROJECT_ROOT%"
    if exist "certificate.pfx" del "certificate.pfx"
    if exist "certificate.b64" del "certificate.b64"
    
    call :log "Cleanup completed"
    goto :eof

REM Main deployment flow
:main
    call :log "Starting Circuit Explorer deployment (version: %VERSION%, environment: %ENVIRONMENT%)"
    
    call :check_prerequisites
    call :setup_environment
    call :run_security_checks
    call :build_application
    call :sign_application
    call :run_tests
    call :create_deployment_package
    
    if "%ENVIRONMENT%"=="staging" (
        call :deploy_staging
    ) else if "%ENVIRONMENT%"=="production" (
        call :deploy_production
    ) else if "%ENVIRONMENT%"=="package-only" (
        call :log "Package-only mode, skipping deployment"
    ) else (
        call :error "Unknown environment: %ENVIRONMENT%"
    )
    
    call :health_check
    call :cleanup
    
    call :log "Deployment completed successfully!"
    call :log "Package: circuit-explorer-%VERSION%-%ENVIRONMENT%.zip"
    goto :eof

REM Handle script interruption
:exit_handler
    call :cleanup
    exit /b 0

REM Main execution
call :main %*
if errorlevel 1 exit /b 1