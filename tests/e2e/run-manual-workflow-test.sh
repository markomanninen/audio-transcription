#!/usr/bin/env bash

# Script to run the manual audio workflow test with local services
# This starts backend and frontend, then runs the comprehensive workflow test

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
RESULTS_DIR="$ROOT_DIR/tests/e2e/test-results/local"
mkdir -p "$RESULTS_DIR"

USE_TRANSCRIPTION_STUB="${USE_TRANSCRIPTION_STUB:-1}"

log() {
  printf '[manual-workflow] %s\n' "$*"
}

fail() {
  log "ERROR: $*"
  exit 1
}

kill_tree() {
  local pid=$1
  local signal=${2:-TERM}

  if [[ -z "$pid" ]]; then
    return
  fi

  if ! kill -0 "$pid" 2>/dev/null; then
    return
  fi

  local children
  children=$(pgrep -P "$pid" || true)
  for child in $children; do
    kill_tree "$child" "$signal"
  done

  if ! kill "-$signal" "$pid" 2>/dev/null; then
    kill "-$signal" "-$pid" 2>/dev/null || true
  fi
}

wait_for_exit() {
  local pid=$1
  local name=$2
  local timeout=${3:-5}

  local elapsed=0
  while kill -0 "$pid" 2>/dev/null; do
    if (( elapsed >= timeout )); then
      log "Timeout waiting for $name to exit, killing..."
      kill_tree "$pid" KILL
      return 1
    fi
    sleep 0.5
    elapsed=$((elapsed + 1))
  done
}

# -------- Find available ports --------
find_free_port() {
  python3 - <<'PY'
import socket
with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    s.bind(('', 0))
    s.listen(1)
    port = s.getsockname()[1]
    print(port)
PY
}

BACKEND_PORT=$(find_free_port)
FRONTEND_PORT=$(find_free_port)

WEB_URL="http://localhost:${FRONTEND_PORT}"
API_URL="http://localhost:${BACKEND_PORT}"

# -------- Database preparation --------
DB_FILENAME="e2e_manual_workflow_${BACKEND_PORT}.db"
DB_PATH="$ROOT_DIR/backend/data/$DB_FILENAME"
if [[ -f "$DB_PATH" ]]; then
  rm -f "$DB_PATH"
fi

# -------- Start backend --------
log "Starting backend on port $BACKEND_PORT"
(
  cd "$ROOT_DIR/backend"
  DATABASE_URL="sqlite:///./data/$DB_FILENAME" \
  AUDIO_STORAGE_PATH="./data/e2e_test_audio" \
  WHISPER_MODEL_SIZE="${WHISPER_MODEL_SIZE:-tiny}" \
  E2E_TRANSCRIPTION_STUB="$USE_TRANSCRIPTION_STUB" \
  python -m uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" \
    > "$RESULTS_DIR/manual-workflow-backend-${BACKEND_PORT}.log" 2>&1
) &
BACKEND_PID=$!

# -------- Start frontend --------
log "Starting frontend on port $FRONTEND_PORT"
(
  cd "$ROOT_DIR/frontend"
  VITE_API_BASE_URL="$API_URL" \
  npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT" \
    > "$RESULTS_DIR/manual-workflow-frontend-${FRONTEND_PORT}.log" 2>&1
) &
FRONTEND_PID=$!

cleanup() {
  local exit_code=$?
  local reason=${1:-EXIT}

  log "Stopping services (reason: $reason)..."

  if [[ -n "${FRONTEND_PID:-}" ]]; then
    if kill -0 "$FRONTEND_PID" 2>/dev/null; then
      log "Stopping frontend (PID $FRONTEND_PID)"
      kill_tree "$FRONTEND_PID" TERM
      wait_for_exit "$FRONTEND_PID" "frontend" 10
    fi
  fi

  if [[ -n "${BACKEND_PID:-}" ]]; then
    if kill -0 "$BACKEND_PID" 2>/dev/null; then
      log "Stopping backend (PID $BACKEND_PID)"
      kill_tree "$BACKEND_PID" TERM
      wait_for_exit "$BACKEND_PID" "backend" 10
    fi
  fi

  exit $exit_code
}

trap cleanup EXIT INT TERM

# -------- Wait for services --------
log "Waiting for backend to be ready..."
for i in {1..60}; do
  if curl -sf "$API_URL/health" >/dev/null 2>&1; then
    log "Backend ready at $API_URL/health"
    break
  fi
  if (( i >= 60 )); then
    fail "Backend failed to start"
  fi
  sleep 1
done

log "Waiting for frontend to be ready..."
for i in {1..60}; do
  if curl -sf "$WEB_URL" >/dev/null 2>&1; then
    log "Frontend ready at $WEB_URL"
    break
  fi
  if (( i >= 60 )); then
    fail "Frontend failed to start"
  fi
  sleep 1
done

# -------- Run the manual workflow test --------
log "Running manual audio workflow test..."

cd "$SCRIPT_DIR"

# Run the Node.js test with the port configuration
TEST_DOCKER=false \
USE_DOCKER=false \
FRONTEND_URL="$WEB_URL" \
BACKEND_URL="$API_URL" \
node manual-workflow-test.js

TEST_EXIT=$?

if [[ $TEST_EXIT -eq 0 ]]; then
  log "Test completed with exit code 0"
else
  log "❌ TEST FAILED with exit code $TEST_EXIT"
  cleanup "FAILURE"
fi

exit $TEST_EXIT
