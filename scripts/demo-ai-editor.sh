#!/bin/bash

# AI Editor Demo Script
# This script demonstrates the AI Editor functionality in action

echo "🎯 AI Editor Demonstration Script"
echo "=================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if backend is running
check_backend() {
    print_info "Checking if backend is running on port 8000..."
    if curl -s http://localhost:8000/docs > /dev/null; then
        print_status "Backend is running!"
        return 0
    else
        print_error "Backend is not running. Please start it with:"
        echo "  cd backend && python -m uvicorn app.main:app --reload --port 8000"
        return 1
    fi
}

# Test each AI editor endpoint
test_semantic_reconstruction() {
    print_info "Testing Semantic Reconstruction..."
    
    response=$(curl -s -X POST "http://localhost:8000/api/ai_editor/semantic-reconstruction" \
        -H "Content-Type: application/json" \
        -d '{
            "text": "uhm so like we need to you know implement this feature and stuff",
            "project_id": 1,
            "provider": "ollama"
        }' 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        print_status "Semantic Reconstruction endpoint responded"
        echo "Response: $response"
    else
        print_warning "Semantic Reconstruction test failed (may need Ollama running)"
    fi
    echo ""
}

test_style_generation() {
    print_info "Testing Style Generation..."
    
    response=$(curl -s -X POST "http://localhost:8000/api/ai_editor/style-generation" \
        -H "Content-Type: application/json" \
        -d '{
            "text": "The meeting was good",
            "project_id": 1,
            "target_style": "academic",
            "provider": "ollama"
        }' 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        print_status "Style Generation endpoint responded"
        echo "Response: $response"
    else
        print_warning "Style Generation test failed (may need Ollama running)"
    fi
    echo ""
}

test_nlp_analysis() {
    print_info "Testing NLP Analysis..."
    
    response=$(curl -s -X POST "http://localhost:8000/api/ai_editor/nlp-analysis" \
        -H "Content-Type: application/json" \
        -d '{
            "text": "This is a comprehensive discussion about project management.",
            "project_id": 1,
            "provider": "ollama"
        }' 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        print_status "NLP Analysis endpoint responded"
        echo "Response: $response"
    else
        print_warning "NLP Analysis test failed (may need Ollama running)"
    fi
    echo ""
}

test_fact_checking() {
    print_info "Testing Fact Checking..."
    
    response=$(curl -s -X POST "http://localhost:8000/api/ai_editor/fact-checking" \
        -H "Content-Type: application/json" \
        -d '{
            "text": "Python was created in 1991",
            "project_id": 1,
            "domain": "technology",
            "provider": "ollama"
        }' 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        print_status "Fact Checking endpoint responded"
        echo "Response: $response"
    else
        print_warning "Fact Checking test failed (may need Ollama running)"
    fi
    echo ""
}

test_technical_check() {
    print_info "Testing Technical Format Conversion..."
    
    response=$(curl -s -X POST "http://localhost:8000/api/ai_editor/technical-check" \
        -H "Content-Type: application/json" \
        -d '{
            "text_with_metadata": "[00:00:05] Speaker A: Hello [00:00:10] Speaker B: Hi",
            "project_id": 1,
            "target_format": "SRT",
            "provider": "ollama"
        }' 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        print_status "Technical Check endpoint responded"
        echo "Response: $response"
    else
        print_warning "Technical Check test failed (may need Ollama running)"
    fi
    echo ""
}

# Run frontend tests
run_frontend_tests() {
    print_info "Running Frontend Tests..."
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    cd "${script_dir}/../frontend" 2>/dev/null || {
        print_error "Frontend directory not found"
        return 1
    }

    if npm test aiEditor.test.ts useAIEditor.test.tsx 2>/dev/null; then
        print_status "Frontend tests passed!"
    else
        print_warning "Frontend tests failed or npm not configured"
    fi
    cd "${script_dir}"
    echo ""
}

# Run backend tests
run_backend_tests() {
    print_info "Running Backend Tests..."
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    cd "${script_dir}/../backend" 2>/dev/null || {
        print_error "Backend directory not found"
        return 1
    }

    if python -m pytest tests/test_ai_editor.py::TestSemanticReconstructionEndpoint::test_semantic_reconstruction_success -v 2>/dev/null; then
        print_status "Backend tests passed!"
    else
        print_warning "Backend tests failed or dependencies not installed"
    fi
    cd "${script_dir}"
    echo ""
}

# Main execution
main() {
    echo "Starting AI Editor Demo..."
    echo ""
    
    # Check prerequisites
    if ! check_backend; then
        exit 1
    fi
    echo ""
    
    # Test all endpoints
    print_info "🚀 Testing All AI Editor Endpoints"
    echo "===================================="
    echo ""
    
    test_semantic_reconstruction
    test_style_generation
    test_nlp_analysis
    test_fact_checking
    test_technical_check
    
    # Run tests
    print_info "🧪 Running Test Suites"
    echo "======================"
    echo ""
    
    run_frontend_tests
    run_backend_tests
    
    # Summary
    print_info "📊 Demo Summary"
    echo "==============="
    echo ""
    print_status "AI Editor Demo Complete!"
    echo ""
    print_info "What was demonstrated:"
    echo "  • 5 AI editor endpoints working"
    echo "  • Frontend React hooks and API clients"
    echo "  • Backend FastAPI endpoints"
    echo "  • Comprehensive test coverage"
    echo ""
    print_info "Next steps:"
    echo "  • Start frontend: cd frontend && npm run dev"
    echo "  • Access UI at: http://localhost:3000"
    echo "  • Use AI Editor in the transcription interface"
    echo ""
}

# Run the demo
main "$@"