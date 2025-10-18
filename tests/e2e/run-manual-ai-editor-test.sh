#!/usr/bin/env bash

# Script to run the manual AI editor workflow test with local services
# This starts backend and frontend, then runs the interactive test

set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
RESULTS_DIR="$ROOT_DIR/tests/e2e/test-results/local"
mkdir -p "$RESULTS_DIR"

USE_TRANSCRIPTION_STUB="${USE_TRANSCRIPTION_STUB:-1}"

log() {
  printf '[manual-ai-test] %s\n' "$*"
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
  local start
  start=$(date +%s)

  while kill -0 "$pid" 2>/dev/null; do
    local now
    now=$(date +%s)
    if (( now - start >= timeout )); then
      log "Force killing $name (PID $pid)"
      kill_tree "$pid" KILL
      break
    fi
    sleep 0.2
  done
}

stop_process() {
  local pid=$1
  local name=$2

  if [[ -z "$pid" ]]; then
    return
  fi

  if ! kill -0 "$pid" 2>/dev/null; then
    return
  fi

  log "Stopping $name (PID $pid)"
  kill_tree "$pid" TERM
  wait_for_exit "$pid" "$name" 5
}

CLEANUP_DONE=0

echo "🚀 Starting Manual AI Editor Workflow Test"
echo "=========================================="
echo ""

# Start services using the run_local_e2e.sh infrastructure
cd "$ROOT_DIR"

# Source the functions from run_local_e2e.sh by extracting relevant parts
source "$ROOT_DIR/.venv/bin/activate"

# Start backend
BACKEND_PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("",0)); print(s.getsockname()[1]); s.close()')
FRONTEND_PORT=$(python3 -c 'import socket; s=socket.socket(); s.bind(("",0)); print(s.getsockname()[1]); s.close()')

# Prepare database
DB_FILENAME="e2e_local_${BACKEND_PORT}.db"
DB_PATH="$ROOT_DIR/backend/data/$DB_FILENAME"
mkdir -p "$ROOT_DIR/backend/data"
[[ -f "$DB_PATH" ]] && rm -f "$DB_PATH"

log "Starting backend on port $BACKEND_PORT"
(
  cd "$ROOT_DIR/backend"
  DATABASE_URL="sqlite:///./data/$DB_FILENAME" \
  WHISPER_MODEL_SIZE="${WHISPER_MODEL_SIZE:-small}" \
  UVICORN_ACCESS_LOG="false" \
  E2E_TRANSCRIPTION_STUB="$USE_TRANSCRIPTION_STUB" \
  SEED_E2E_DATA="1" \
  "$ROOT_DIR/.venv/bin/python" -m uvicorn app.main:app --host 127.0.0.1 --port "$BACKEND_PORT"
) > "$RESULTS_DIR/backend-$BACKEND_PORT.log" 2>&1 &
BACKEND_PID=$!

log "Starting frontend on port $FRONTEND_PORT"
cd "$ROOT_DIR/frontend"
VITE_API_BASE_URL="http://127.0.0.1:$BACKEND_PORT" \
npm run dev -- --host 127.0.0.1 --port "$FRONTEND_PORT" \
  > "$RESULTS_DIR/frontend-$FRONTEND_PORT.log" 2>&1 &
FRONTEND_PID=$!

cleanup() {
  local reason=${1:-EXIT}
  if [[ $CLEANUP_DONE -eq 1 ]]; then
    return
  fi
  CLEANUP_DONE=1

  log "Stopping services (reason: $reason)..."
  stop_process "${FRONTEND_PID:-}" "frontend"
  stop_process "${BACKEND_PID:-}" "backend"

  if [[ -n "${BACKEND_PID:-}" ]]; then
    wait "${BACKEND_PID}" 2>/dev/null || true
  fi

  if [[ -n "${FRONTEND_PID:-}" ]]; then
    wait "${FRONTEND_PID}" 2>/dev/null || true
  fi

  if [[ -n "${DB_PATH:-}" && -f "$DB_PATH" ]]; then
    rm -f "$DB_PATH"
  fi
}
trap 'cleanup SIGINT; exit 130' INT
trap 'cleanup SIGTERM; exit 143' TERM
trap 'cleanup EXIT' EXIT

# Wait for services
log "Waiting for backend to be ready..."
for i in {1..30}; do
  if curl -sf "http://127.0.0.1:$BACKEND_PORT/health" >/dev/null 2>&1; then
    log "Backend ready at http://127.0.0.1:$BACKEND_PORT/health"
    break
  fi
  [[ $i -eq 30 ]] && fail "Backend did not become ready"
  sleep 1
done

log "Waiting for frontend to be ready..."
for i in {1..30}; do
  if curl -sf "http://127.0.0.1:$FRONTEND_PORT" >/dev/null 2>&1; then
    log "Frontend ready at http://127.0.0.1:$FRONTEND_PORT"
    break
  fi
  [[ $i -eq 30 ]] && fail "Frontend did not become ready"
  sleep 1
done

# Run the manual test
log "Running manual AI editor workflow test..."
cd "$ROOT_DIR/tests/e2e"
FRONTEND_PORT="$FRONTEND_PORT" BACKEND_PORT="$BACKEND_PORT" node ai-text-editor-workflow-test.js
TEST_EXIT=$?

log "Test completed with exit code $TEST_EXIT"
exit $TEST_EXIT
