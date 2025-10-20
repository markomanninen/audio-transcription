#!/bin/bash

# Quick Start Docker Development Environment
# Use this for daily development when dependencies haven't changed

set -e  # Exit on any error

echo "🚀 Starting Docker development environment..."

# Navigate to project root
cd "$(dirname "$0")/.."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker first."
    exit 1
fi

echo "🚢 Starting all services..."
docker-compose up -d

echo "⏳ Waiting for services to initialize..."
sleep 5

echo "🔍 Checking service status..."
docker-compose ps

echo ""
echo "🎉 Development environment is running!"
echo ""
echo "📡 Services available at:"
echo "   Frontend:  http://localhost:3000"
echo "   Backend:   http://localhost:8080"
echo "   API Docs:  http://localhost:8080/docs"
echo "   Health:    http://localhost:8080/health"
echo ""
echo "💡 If you encounter dependency issues, run: ./scripts/docker-dev-setup.sh"
echo ""