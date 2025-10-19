#!/usr/bin/env bash
set -euo pipefail

# Script is in /scripts/, so repo root is parent directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.prod.yml"

INFO_PREFIX="[INFO]"
WARN_PREFIX="[WARN]"
ERROR_PREFIX="[ERROR]"

COMPOSE_CMD=()
PULL_IMAGES=1
PRELOAD_MODELS=1
RUN_HEALTH_CHECK=1
BUILD_IMAGES=1

function print_info() {
  echo "${INFO_PREFIX} $*"
}

function print_warn() {
  echo "${WARN_PREFIX} $*" >&2
}

function print_error() {
  echo "${ERROR_PREFIX} $*" >&2
}

function usage() {
  cat <<USAGE
Usage: $(basename "$0") [options]

Bootstraps the production Docker stack (backend, frontend, Redis, Ollama).

Options:
  --no-pull           Skip docker compose pull step.
  --no-build          Skip docker compose build step.
  --skip-models       Do not pre-download Whisper and Ollama models.
  --skip-health       Skip health checks after startup.
  -h, --help          Show this help and exit.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-pull)
      PULL_IMAGES=0
      shift
      ;;
    --no-build)
      BUILD_IMAGES=0
      shift
      ;;
    --skip-models)
      PRELOAD_MODELS=0
      shift
      ;;
    --skip-health)
      RUN_HEALTH_CHECK=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      print_error "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  print_error "Could not locate ${COMPOSE_FILE}. Run this script from the repository root."
  exit 1
fi

if ! command -v docker > /dev/null 2>&1; then
  print_error "Docker is not installed or not in PATH."
  exit 1
fi

if docker compose version > /dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose > /dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  print_error "Docker Compose is not available (requires Docker CLI with compose plugin or docker-compose)."
  exit 1
fi

if ! command -v curl > /dev/null 2>&1; then
  print_warn "curl not found; health checks will use python instead."
fi

function ensure_env_file() {
  local env_file="${PROJECT_ROOT}/backend/.env"
  if [[ ! -f "${env_file}" ]]; then
    cp "${PROJECT_ROOT}/backend/.env.example" "${env_file}"
    print_info "Created backend/.env from backend/.env.example (update secrets as needed)."
  fi
}

function build_images() {
  if [[ "${BUILD_IMAGES}" -eq 1 ]]; then
    print_info "Building backend and frontend images..."
    docker_compose build backend frontend
  else
    print_info "Skipping image build (per flag)."
  fi
}

function backend_env_value() {
  local key="$1"
  local default="$2"
  local env_file="${PROJECT_ROOT}/backend/.env"
  if [[ -f "${env_file}" ]]; then
    local value
    value="$(grep -E "^${key}=" "${env_file}" | tail -n1 | cut -d '=' -f2- || true)"
    if [[ -n "${value}" ]]; then
      echo "${value}"
      return
    fi
  fi
  echo "${default}"
}

function port_in_use() {
  local port="$1"
  if command -v lsof > /dev/null 2>&1; then
    lsof -iTCP:"${port}" -sTCP:LISTEN > /dev/null 2>&1
  elif command -v ss > /dev/null 2>&1; then
    ss -ltn "( sport = :${port} )" > /dev/null 2>&1
  else
    return 1
  fi
}

function check_ports() {
  local ports=("80:frontend" "8000:backend API" "6379:Redis" "11434:Ollama")
  for entry in "${ports[@]}"; do
    local port="${entry%%:*}"
    local name="${entry#*:}"
    if port_in_use "${port}"; then
      print_warn "Port ${port} appears to be in use. ${name} service may fail to start."
    fi
  done
}

function docker_compose() {
  "${COMPOSE_CMD[@]}" -f "${COMPOSE_FILE}" "$@"
}

function pull_images() {
  if [[ "${PULL_IMAGES}" -eq 1 ]]; then
    print_info "Pulling latest images..."
    docker_compose pull
  else
    print_info "Skipping image pull (per flag)."
  fi
}

function start_stack() {
  print_info "Starting production stack..."
  docker_compose up -d
  docker_compose ps
}

function wait_for_backend() {
  if [[ "${RUN_HEALTH_CHECK}" -ne 1 ]]; then
    return
  fi

  local retries=30
  local delay=5
  local health_url="http://localhost:8000/health"

  print_info "Waiting for backend health endpoint (${health_url})..."
  for ((i=1; i<=retries; i++)); do
    if command -v curl > /dev/null 2>&1; then
      if curl -sSf "${health_url}" > /dev/null 2>&1; then
        print_info "Backend is healthy."
        return
      fi
    else
      if python - <<PY > /dev/null 2>&1; then
import urllib.request
urllib.request.urlopen("${health_url}", timeout=5)
PY
        print_info "Backend is healthy."
        return
      fi
    fi
    sleep "${delay}"
  done

  print_warn "Backend health check did not succeed after $((retries * delay)) seconds."
}

function ensure_whisper_model() {
  if [[ "${PRELOAD_MODELS}" -ne 1 ]]; then
    return
  fi

  local model
  model="$(backend_env_value "WHISPER_MODEL_SIZE" "base")"

  print_info "Ensuring Whisper model '${model}' is available inside backend container..."
  docker_compose exec -T backend python - <<PY
import os
import sys
model = os.environ.get("WHISPER_MODEL_SIZE", "${model}")
try:
    import whisper
except Exception as exc:
    print(f"Failed to import whisper: {exc}", file=sys.stderr)
    sys.exit(1)

print(f"Downloading/load whisper model '{model}' (this may take a while the first time)...")
whisper.load_model(model)
print("Whisper model ready.")
PY
}

function ensure_ollama_model() {
  if [[ "${PRELOAD_MODELS}" -ne 1 ]]; then
    return
  fi

  local model
  model="$(backend_env_value "OLLAMA_MODEL" "llama3.2:1b")"

  print_info "Ensuring Ollama model '${model}' is available..."
  if docker_compose exec -T ollama sh -c "ollama list | grep -q \"${model}\""; then
    print_info "Ollama model '${model}' already present."
  else
    print_info "Pulling Ollama model '${model}' (this may take a while)..."
    docker_compose exec -T ollama ollama pull "${model}"
  fi
}

function verify_services() {
  if [[ "${RUN_HEALTH_CHECK}" -ne 1 ]]; then
    return
  fi

  print_info "Checking Redis connectivity..."
  if docker_compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    print_info "Redis responded to PING."
  else
    print_warn "Redis PING failed. Check redis logs with 'docker compose -f ${COMPOSE_FILE} logs redis'."
  fi

  print_info "Checking Ollama status..."
  if docker_compose exec -T ollama sh -c "ollama list" > /dev/null 2>&1; then
    print_info "Ollama is reachable."
  else
    print_warn "Unable to query Ollama. Inspect logs with 'docker compose -f ${COMPOSE_FILE} logs ollama'."
  fi
}

function print_summary() {
  cat <<SUMMARY

Application is running!

- Frontend UI:      http://localhost:80
- Backend API docs: http://localhost:8000/docs
- Redis:            redis://localhost:6379 (internal service)
- Ollama API:       http://localhost:11434

Next steps:
- Run 'docker compose -f ${COMPOSE_FILE} logs -f backend' to monitor transcription jobs.
- Use 'docker compose -f ${COMPOSE_FILE} down' when you are finished.

SUMMARY
}

ensure_env_file
check_ports
build_images
pull_images
start_stack
wait_for_backend
ensure_whisper_model
ensure_ollama_model
verify_services
print_summary
