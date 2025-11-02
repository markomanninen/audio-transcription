#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESULTS_DIR="$ROOT_DIR/tests/e2e/test-results/local"
mkdir -p "$RESULTS_DIR"

USE_TRANSCRIPTION_STUB="${USE_TRANSCRIPTION_STUB:-1}"

log() {
  printf '[local-e2e] %s\n' "$*"
}

fail() {
  log "ERROR: $*"
  exit 1
}

# -------- Python environment --------
if [[ -n "${LOCAL_PYTHON:-}" ]]; then
  PYTHON_BIN="${LOCAL_PYTHON}"
else
  if command -v python3.11 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3.11)"
  elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3)"
  else
    fail "python3 is required but was not found on PATH"
  fi
fi

if [[ ! -f "$ROOT_DIR/.venv/bin/python" ]]; then
  log "Creating virtual environment (.venv) with $PYTHON_BIN"
  "$PYTHON_BIN" -m venv "$ROOT_DIR/.venv"
fi

source "$ROOT_DIR/.venv/bin/activate"

log "Ensuring backend dependencies are installed"
BACKEND_SENTINEL="$ROOT_DIR/.venv/.deps_installed"
if [[ ! -f "$BACKEND_SENTINEL" ]]; then
  if ! pip install --disable-pip-version-check --quiet -r "$ROOT_DIR/backend/requirements.txt"; then
    fail "pip failed to install backend/requirements.txt. Connect to the internet or preinstall dependencies in .venv."
  fi
  touch "$BACKEND_SENTINEL"
else
  log "Backend dependencies already installed (skipping pip install)"
fi

if [[ "$USE_TRANSCRIPTION_STUB" != "1" ]]; then
  if ! python - <<'PY' >/dev/null 2>&1
import importlib
importlib.import_module("whisper")
PY
  then
    log "openai-whisper not detected in current virtualenv; attempting installation"
    if ! pip install --disable-pip-version-check --quiet openai-whisper; then
      log "WARNING: Unable to install openai-whisper automatically. Continuing without Whisper; transcription features may be limited."
    fi
  fi
else
  log "Using transcription stub; skipping openai-whisper installation"
fi

# -------- Playwright dependencies --------
pushd "$ROOT_DIR/tests/e2e" >/dev/null
PLAYWRIGHT_SENTINEL="$ROOT_DIR/tests/e2e/.deps_installed"
if [[ ! -f "$PLAYWRIGHT_SENTINEL" ]]; then
  log "Installing Playwright dependencies"
  npm install --silent
  npx playwright install --with-deps >/dev/null
  touch "$PLAYWRIGHT_SENTINEL"
else
  log "Playwright dependencies already installed (skipping npm install)"
fi
popd >/dev/null

# -------- Helper functions --------
find_free_port() {
  local start=$1
  python - "$start" <<'PY'
import socket, sys
start = int(sys.argv[1])
for port in range(start, start + 500):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.2)
        if s.connect_ex(('127.0.0.1', port)) != 0:
            print(port)
            break
PY
}

port_in_use() {
  local port=$1
  python - "$port" <<'PY'
import socket, sys
port = int(sys.argv[1])
with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    s.settimeout(0.2)
    sys.exit(0 if s.connect_ex(('127.0.0.1', port)) == 0 else 1)
PY
  return $?
}

ensure_port_free() {
  local port=$1
  local pids
  pids=$(lsof -ti tcp:$port 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    log "Port $port is in use. Terminating processes: $pids"
    kill $pids || true
    sleep 1
  fi
}

wait_for_url() {
  local url=$1
  local timeout=${2:-180}
  local label=${3:-service}
  local elapsed=0
  until curl -sSf "$url" >/dev/null 2>&1; do
    if (( elapsed >= timeout )); then
      fail "Timed out waiting for $label at $url"
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  log "$label ready at $url"
}

# -------- Port selection --------
BACKEND_PORT="${LOCAL_BACKEND_PORT:-$(find_free_port 18200)}"
FRONTEND_PORT="${LOCAL_FRONTEND_PORT:-$(find_free_port 18300)}"

ensure_port_free "$BACKEND_PORT"
ensure_port_free "$FRONTEND_PORT"

if port_in_use "$BACKEND_PORT"; then
  new_backend_port=$(find_free_port $((BACKEND_PORT + 1)))
  log "Port $BACKEND_PORT is still in use. Switching backend to $new_backend_port"
  BACKEND_PORT="$new_backend_port"
fi

if port_in_use "$FRONTEND_PORT"; then
  new_frontend_port=$(find_free_port $((FRONTEND_PORT + 1)))
  log "Port $FRONTEND_PORT is still in use. Switching frontend to $new_frontend_port"
  FRONTEND_PORT="$new_frontend_port"
fi

WEB_URL="${LOCAL_WEB_URL:-http://127.0.0.1:${FRONTEND_PORT}}"
API_URL="http://127.0.0.1:${BACKEND_PORT}"

# -------- Database preparation --------
DB_FILENAME="e2e_local_${BACKEND_PORT}.db"
DB_PATH="$ROOT_DIR/backend/data/$DB_FILENAME"
if [[ -f "$DB_PATH" ]]; then
  rm -f "$DB_PATH"
fi

# -------- Start backend --------
BACKEND_LOG="$RESULTS_DIR/backend-${BACKEND_PORT}.log"
log "Starting backend on port $BACKEND_PORT (logs: $BACKEND_LOG)"
# Ensure log directory exists
mkdir -p "$(dirname "$BACKEND_LOG")"
touch "$BACKEND_LOG"
(
  cd "$ROOT_DIR/backend"
  # Ensure homebrew binaries are in PATH for ffmpeg/ffprobe
  export PATH="/opt/homebrew/bin:$PATH"
  DATABASE_URL="sqlite:///./data/$DB_FILENAME" \
  AUDIO_STORAGE_PATH="./data/e2e_test_audio" \
  WHISPER_MODEL_SIZE="${WHISPER_MODEL_SIZE:-tiny}" \
  UVICORN_ACCESS_LOG="false" \
  E2E_TRANSCRIPTION_STUB="$USE_TRANSCRIPTION_STUB" \
  SEED_E2E_DATA="1" \
  DEBUG="true" \
  "$ROOT_DIR/.venv/bin/python" -m uvicorn app.main:app --host 127.0.0.1 --port "$BACKEND_PORT" --log-level debug
) >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

# -------- Start frontend --------
FRONTEND_LOG="$RESULTS_DIR/frontend-${FRONTEND_PORT}.log"
log "Starting frontend dev server on port $FRONTEND_PORT (logs: $FRONTEND_LOG)"
(
  cd "$ROOT_DIR/frontend"
  VITE_API_BASE_URL="$API_URL" \
  VITE_E2E_MODE="1" \
  npm run dev -- --host 127.0.0.1 --port "$FRONTEND_PORT"
) >"$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

cleanup() {
  exit_code=$?
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    log "Stopping frontend (PID $FRONTEND_PID)"
    kill "$FRONTEND_PID" 2>/dev/null || true
    wait "$FRONTEND_PID" 2>/dev/null || true
  fi
  if [[ -n "${BACKEND_PID:-}" ]]; then
    log "Stopping backend (PID $BACKEND_PID)"
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
  
  # Show backend logs if they exist
  if [[ -f "$BACKEND_LOG" ]]; then
    log "=== BACKEND LOGS ==="
    tail -n 50 "$BACKEND_LOG" | grep -E "(🦙|🌐|✅|❌|timeout|Ollama|error|ERROR)" || true
    log "=== END BACKEND LOGS ==="
  fi
  
  exit $exit_code
}
trap cleanup EXIT

# -------- Wait for services --------
wait_for_url "$API_URL/health" 240 "backend"
wait_for_url "$WEB_URL" 180 "frontend"

# -------- Run Playwright tests --------
log "Running Playwright tests against $WEB_URL (API: $API_URL)"
pushd "$ROOT_DIR/tests/e2e" >/dev/null
PW_DISABLE_WEB_SERVER=1 \
LOCAL_WEB_URL="$WEB_URL" \
LOCAL_API_URL="$API_URL" \
LOCAL_BACKEND_PORT="$BACKEND_PORT" \
LOCAL_FRONTEND_PORT="$FRONTEND_PORT" \
npx playwright test -c playwright.local.config.ts "$@"
TEST_EXIT=$?
popd >/dev/null

exit $TEST_EXIT
