#!/bin/bash

# Docker Development Environment Setup Script
# This script ensures all dependencies are properly installed and containers are built fresh

set -e  # Exit on any error

echo "🚀 Setting up Docker development environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Navigate to project root
cd "$(dirname "$0")/.."

echo "📦 Stopping any existing containers..."
docker-compose down -v

echo "🛠️  Building containers with fresh dependencies..."
echo "   Building frontend (this may take a few minutes)..."
docker-compose build --no-cache frontend

echo "   Building backend (this may take several minutes)..."
docker-compose build --no-cache backend

echo "🚢 Starting all services..."
docker-compose up -d

echo "⏳ Waiting for services to start..."
sleep 10

echo "🔍 Checking service health..."

# Check backend health
BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health || echo "000")
if [ "$BACKEND_HEALTH" = "200" ]; then
    echo "✅ Backend is healthy (http://localhost:8080)"
else
    echo "⚠️  Backend not ready yet, checking logs..."
    docker-compose logs backend | tail -5
fi

# Check frontend accessibility
FRONTEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "000")
if [ "$FRONTEND_HEALTH" = "200" ]; then
    echo "✅ Frontend is accessible (http://localhost:3000)"
else
    echo "⚠️  Frontend not ready yet, checking logs..."
    docker-compose logs frontend | tail -5
fi

echo ""
echo "🎉 Docker development environment setup complete!"
echo ""
echo "📡 Services available at:"
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:8080"
echo "   API Docs:  http://localhost:8080/docs"
echo "   Health:    http://localhost:8080/health"
echo ""
echo "📋 Useful commands:"
echo "   View logs:     docker-compose logs [service]"
echo "   Stop all:      docker-compose down"
echo "   Restart:       docker-compose restart [service]"
echo "   Shell access:  docker-compose exec [service] sh"
echo ""