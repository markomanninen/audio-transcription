#!/usr/bin/env bash
set -euo pipefail

# Multi-platform publisher for both backend and frontend
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

BACKEND_SCRIPT="${SCRIPT_DIR}/publish_backend_multiplatform.sh"
FRONTEND_SCRIPT="${SCRIPT_DIR}/publish_frontend_multiplatform.sh"

# Default to CPU variant (faster, smaller)
# Set TORCH_VARIANT=cuda for GPU support
export TORCH_VARIANT="${TORCH_VARIANT:-cpu}"

INFO="[INFO]"
ERROR="[ERROR]"

function log() {
  echo "${INFO} $*"
}

function fail() {
  echo "${ERROR} $*" >&2
  exit 1
}

if [[ ! -f "${BACKEND_SCRIPT}" ]]; then
  fail "Missing ${BACKEND_SCRIPT}"
fi

if [[ ! -f "${FRONTEND_SCRIPT}" ]]; then
  fail "Missing ${FRONTEND_SCRIPT}"
fi

# Make scripts executable if needed
chmod +x "${BACKEND_SCRIPT}"
chmod +x "${FRONTEND_SCRIPT}"

log "Starting multi-platform image publishing..."
log "Publishing BOTH CPU and CUDA variants"
log ""

# Build CPU variant (default, multi-platform)
log "=== Building CPU variant (multi-platform) ==="
export TORCH_VARIANT=cpu
"${BACKEND_SCRIPT}"
echo ""

# Build CUDA variant (GPU support, amd64 only)
log "=== Building CUDA variant (GPU-enabled) ==="
export TORCH_VARIANT=cuda
"${BACKEND_SCRIPT}"
echo ""

# Build frontend (once, multi-platform)
log "=== Building frontend (multi-platform) ==="
"${FRONTEND_SCRIPT}"
echo ""

log "✅ All multi-platform images published successfully"
log ""
log "Backend images published:"
log "  - markomann/audio-transcription-backend:latest (CPU, amd64+arm64)"
log "  - markomann/audio-transcription-backend:latest-cuda (GPU, amd64)"
log "Frontend image published:"
log "  - markomann/audio-transcription-frontend:latest (amd64+arm64)"
