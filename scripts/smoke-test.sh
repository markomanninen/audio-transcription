#!/bin/bash
# Smoke tests for transcription application

set -e

echo "🔍 Running smoke tests..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

test_backend_health() {
    echo -n "Testing backend health endpoint..."
    if curl -s -f http://localhost:8000/health > /dev/null; then
        echo -e " ${GREEN}✓${NC}"
        ((PASSED++))
    else
        echo -e " ${RED}✗${NC}"
        ((FAILED++))
    fi
}

test_backend_api_docs() {
    echo -n "Testing backend API docs..."
    if curl -s -f http://localhost:8000/docs > /dev/null; then
        echo -e " ${GREEN}✓${NC}"
        ((PASSED++))
    else
        echo -e " ${RED}✗${NC}"
        ((FAILED++))
    fi
}

test_frontend() {
    echo -n "Testing frontend..."
    if curl -s -f http://localhost:5173 > /dev/null; then
        echo -e " ${GREEN}✓${NC}"
        ((PASSED++))
    else
        echo -e " ${RED}✗${NC}"
        ((FAILED++))
    fi
}

test_llm_logs_endpoint() {
    echo -n "Testing LLM logs API endpoint..."
    if curl -s -f http://localhost:8000/api/llm/logs > /dev/null; then
        echo -e " ${GREEN}✓${NC}"
        ((PASSED++))
    else
        echo -e " ${RED}✗${NC}"
        ((FAILED++))
    fi
}

# Run tests
test_backend_health
test_backend_api_docs
test_frontend
test_llm_logs_endpoint

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Results: ${GREEN}${PASSED} passed${NC}, ${RED}${FAILED} failed${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $FAILED -gt 0 ]; then
    exit 1
fi
