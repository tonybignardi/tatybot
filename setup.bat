@echo off
setlocal enabledelayedexpansion

echo 🤖 Bot WhatsApp Gerenciador - Setup Inicial
echo.

REM Verifica se Node.js está instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js não está instalado. Por favor, instale antes de continuar.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo ✅ Node.js encontrado: %NODE_VERSION%
echo.

REM Verifica se .env existe
if not exist .env (
    echo 📝 Criando arquivo .env...
    copy .env.example .env
    echo ✅ Arquivo .env criado!
    echo ⚠️  Por favor, edite o arquivo .env com suas configurações de MongoDB
    echo.
)

REM Instala dependências se necessário
if not exist node_modules (
    echo 📦 Instalando dependências...
    call npm install
    echo.
)

echo ✅ Tudo pronto!
echo.
echo Para iniciar o bot, execute:
echo   npm start
echo.
echo Para gerenciar dados:
echo   npm run admin
echo.
pause
