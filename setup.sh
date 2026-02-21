#!/bin/bash

echo "🤖 Bot WhatsApp Gerenciador - Setup Inicial"
echo ""

# Verifica se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não está instalado. Por favor, instale antes de continuar."
    exit 1
fi

echo "✅ Node.js encontrado: $(node -v)"
echo ""

# Verifica se .env existe
if [ ! -f .env ]; then
    echo "📝 Criando arquivo .env..."
    cp .env.example .env
    echo "✅ Arquivo .env criado!"
    echo "⚠️  Por favor, edite o arquivo .env com suas configurações de MongoDB"
    echo ""
fi

# Instala dependências se necessário
if [ ! -d node_modules ]; then
    echo "📦 Instalando dependências..."
    npm install
    echo ""
fi

echo "✅ Tudo pronto!"
echo ""
echo "Para iniciar o bot, execute:"
echo "  npm start"
echo ""
echo "Para gerenciar dados:"
echo "  npm run admin"
echo ""
