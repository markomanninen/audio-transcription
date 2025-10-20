#!/bin/bash

# Stop Docker Development Environment

set -e  # Exit on any error

echo "🛑 Stopping Docker development environment..."

# Navigate to project root
cd "$(dirname "$0")/.."

# Stop all services
docker-compose down

echo "✅ All services stopped."
echo ""
echo "💡 To remove all data volumes as well, run: docker-compose down -v"
echo "💡 To start again, run: ./scripts/docker-dev-start.sh"
echo ""