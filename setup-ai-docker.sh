#!/bin/bash

# Quick setup script for Docker + Local development
echo "🐳 Setting up AI Editor with Docker Ollama"
echo "==========================================="

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose not found. Please install Docker."
    exit 1
fi

echo "📋 Setup Steps:"
echo "1. Starting Ollama in Docker..."

# Start Ollama with exposed port
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up ollama -d

echo "⏳ Waiting for Ollama to start..."
sleep 5

# Check if Ollama is accessible
if curl -s http://localhost:11434/api/tags > /dev/null; then
    echo "✅ Ollama is running and accessible on localhost:11434"
else
    echo "⚠️  Ollama may still be starting... Continue anyway"
fi

echo ""
echo "2. Installing AI model (if not already installed)..."

# Pull a lightweight model
docker exec $(docker-compose ps -q ollama) ollama pull llama3.2:1b 2>/dev/null || echo "ℹ️  Model may already be installed or container starting"

echo ""
echo "3. Setting up local backend environment..."

# Set environment variable for local development
export OLLAMA_BASE_URL=http://localhost:11434
echo "📋 Set OLLAMA_BASE_URL=http://localhost:11434"

echo ""
echo "🚀 Ready to start development!"
echo ""
echo "💡 Next steps:"
echo "   1. Start backend locally:"
echo "      cd backend"
echo "      export OLLAMA_BASE_URL=http://localhost:11434" 
echo "      python -m uvicorn app.main:app --reload --port 8000"
echo ""
echo "   2. Start frontend locally:"
echo "      cd frontend"
echo "      npm run dev"
echo ""
echo "   3. Test AI Editor:"
echo "      ./demo-ai-editor.sh"
echo ""
echo "🐳 Alternative: Run everything in Docker:"
echo "   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build"