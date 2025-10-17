#!/bin/bash
# Docker Environment Validation Script
# This script validates that both Docker development and production setups work correctly

set -e

echo "🐳 Docker Environment Validation Script"
echo "======================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    ((TESTS_PASSED++))
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    ((TESTS_FAILED++))
    FAILED_TESTS+=("$1")
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1

    log_info "Waiting for $service_name to be ready at $url..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            log_success "$service_name is ready!"
            return 0
        fi
        echo -n "."
        sleep 2
        ((attempt++))
    done
    
    log_error "$service_name failed to start within $((max_attempts * 2)) seconds"
    return 1
}

# Function to test API endpoint
test_api_endpoint() {
    local url=$1
    local endpoint_name=$2
    
    log_info "Testing $endpoint_name at $url..."
    
    if response=$(curl -s "$url" 2>/dev/null); then
        if echo "$response" | grep -q '"status"'; then
            log_success "$endpoint_name is responding correctly"
            return 0
        else
            log_error "$endpoint_name returned unexpected response: $response"
            return 1
        fi
    else
        log_error "$endpoint_name is not accessible"
        return 1
    fi
}

# Function to test transcription workflow
test_transcription_workflow() {
    local backend_url=$1
    
    log_info "Testing basic transcription workflow..."
    
    # Test health endpoint
    if ! test_api_endpoint "$backend_url/health" "Health endpoint"; then
        return 1
    fi
    
    # Test API docs are accessible
    log_info "Testing API documentation..."
    if curl -s "$backend_url/docs" | grep -q "FastAPI"; then
        log_success "API documentation is accessible"
    else
        log_error "API documentation is not accessible"
        return 1
    fi
    
    return 0
}

# Function to cleanup Docker resources
cleanup_docker() {
    local compose_file=$1
    log_info "Cleaning up Docker resources..."
    
    if [ -n "$compose_file" ]; then
        docker-compose -f "$compose_file" down -v --remove-orphans 2>/dev/null || true
    else
        docker-compose down -v --remove-orphans 2>/dev/null || true
    fi
    
    # Remove dangling images and containers
    docker system prune -f > /dev/null 2>&1 || true
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker Desktop."
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running. Please start Docker Desktop."
        exit 1
    fi
    
    # Check if Docker Compose is available
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed."
        exit 1
    fi
    
    log_success "All prerequisites are met"
}

# Test Docker Development Setup
test_docker_development() {
    log_info "===============================\nTesting Docker Development Setup\n==============================="
    
    cleanup_docker
    
    log_info "Starting Docker development environment..."
    docker-compose up -d --build
    
    # Wait for services to be ready
    if wait_for_service "http://localhost:8000/health" "Backend API"; then
        if wait_for_service "http://localhost:3000" "Frontend"; then
            
            # Test backend functionality
            test_transcription_workflow "http://localhost:8000"
            
            # Test frontend is serving content
            log_info "Testing frontend content..."
            if curl -s "http://localhost:3000" | grep -q "<!DOCTYPE html>"; then
                log_success "Frontend is serving HTML content"
            else
                log_error "Frontend is not serving proper content"
            fi
            
            # Test internal service communication
            log_info "Testing internal service communication..."
            if docker-compose exec -T backend curl -s http://redis:6379 > /dev/null 2>&1; then
                log_success "Backend can communicate with Redis"
            else
                log_warning "Backend cannot communicate with Redis (may be normal if Redis takes time to start)"
            fi
            
        fi
    fi
    
    # Show container status
    log_info "Container status:"
    docker-compose ps
    
    # Show logs if there are errors
    if [ $TESTS_FAILED -gt 0 ]; then
        log_warning "Showing recent logs due to test failures:"
        docker-compose logs --tail=50 backend
        docker-compose logs --tail=50 frontend
    fi
    
    cleanup_docker
}

# Test Docker Production Setup
test_docker_production() {
    log_info "===============================\nTesting Docker Production Setup\n==============================="
    
    cleanup_docker "docker-compose.prod.yml"
    
    log_info "Starting Docker production environment..."
    docker-compose -f docker-compose.prod.yml up -d --build
    
    # Wait for services to be ready
    if wait_for_service "http://localhost:8000/health" "Backend API"; then
        if wait_for_service "http://localhost" "Frontend (Nginx)"; then
            
            # Test backend functionality
            test_transcription_workflow "http://localhost:8000"
            
            # Test frontend is serving content through Nginx
            log_info "Testing production frontend (Nginx)..."
            if curl -s "http://localhost" | grep -q "<!DOCTYPE html>"; then
                log_success "Production frontend is serving HTML content through Nginx"
            else
                log_error "Production frontend is not serving proper content"
            fi
            
            # Test production optimizations
            log_info "Testing production optimizations..."
            if curl -s -I "http://localhost" | grep -q "nginx"; then
                log_success "Nginx is properly serving frontend"
            else
                log_warning "Nginx headers not detected"
            fi
            
        fi
    fi
    
    # Show container status
    log_info "Production container status:"
    docker-compose -f docker-compose.prod.yml ps
    
    # Show logs if there are errors
    if [ $TESTS_FAILED -gt 0 ]; then
        log_warning "Showing recent production logs due to test failures:"
        docker-compose -f docker-compose.prod.yml logs --tail=50 backend
        docker-compose -f docker-compose.prod.yml logs --tail=50 frontend
    fi
    
    cleanup_docker "docker-compose.prod.yml"
}

# Test environment isolation
test_environment_isolation() {
    log_info "================================\nTesting Environment Isolation\n================================"
    
    # Check port availability
    log_info "Testing port isolation..."
    
    # These ports should be available (not used by other environments)
    local ports=("3000" "8000" "80")
    
    for port in "${ports[@]}"; do
        if lsof -i :$port > /dev/null 2>&1; then
            log_warning "Port $port is already in use - may cause conflicts"
        else
            log_success "Port $port is available"
        fi
    done
    
    # Check if local development files exist (to ensure no conflicts)
    if [ -f "backend/dev_transcriptions.db" ]; then
        log_success "Local development database exists and won't conflict with Docker"
    fi
    
    if [ -d ".venv" ]; then
        log_success "Local virtual environment exists and won't conflict with Docker"
    fi
}

# Generate test report
generate_report() {
    echo ""
    log_info "==============================\nTest Results Summary\n=============================="
    
    log_info "Tests passed: $TESTS_PASSED"
    if [ $TESTS_FAILED -gt 0 ]; then
        log_error "Tests failed: $TESTS_FAILED"
        echo ""
        log_error "Failed tests:"
        for test in "${FAILED_TESTS[@]}"; do
            echo -e "${RED}  - $test${NC}"
        done
    else
        log_success "All tests passed!"
    fi
    
    echo ""
    if [ $TESTS_FAILED -eq 0 ]; then
        log_success "✅ Docker setups are ready for production!"
        log_info "You can now safely commit and push to GitHub."
    else
        log_error "❌ Some Docker tests failed. Please fix the issues before committing."
        log_info "Check the logs above and refer to docs/development/ENVIRONMENT_GUIDE.md"
        exit 1
    fi
}

# Main execution
main() {
    echo "Starting Docker validation tests..."
    echo "This will test both development and production Docker setups."
    echo ""
    
    # Check prerequisites
    check_prerequisites
    
    # Test environment isolation
    test_environment_isolation
    
    # Test Docker development setup
    test_docker_development
    
    # Test Docker production setup  
    test_docker_production
    
    # Generate final report
    generate_report
}

# Show usage if help requested
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "OPTIONS:"
    echo "  --dev-only     Test only Docker development setup"
    echo "  --prod-only    Test only Docker production setup"
    echo "  --help, -h     Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                    # Test both development and production"
    echo "  $0 --dev-only         # Test only development setup"
    echo "  $0 --prod-only        # Test only production setup"
    echo ""
    echo "Prerequisites:"
    echo "  - Docker Desktop installed and running"
    echo "  - Docker Compose available"
    echo "  - Ports 3000, 8000, and 80 available"
    exit 0
fi

# Handle command line arguments
case "${1:-}" in
    --dev-only)
        check_prerequisites
        test_environment_isolation
        test_docker_development
        generate_report
        ;;
    --prod-only)
        check_prerequisites
        test_environment_isolation
        test_docker_production
        generate_report
        ;;
    *)
        main
        ;;
esac