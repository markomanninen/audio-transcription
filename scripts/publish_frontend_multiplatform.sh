#!/usr/bin/env bash
set -euo pipefail

# Multi-platform frontend image publisher using buildx
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
FRONTEND_DIR="${REPO_ROOT}/frontend"
REMOTE_IMAGE_NAME="markomann/audio-transcription-frontend:latest"
PLATFORMS="linux/amd64,linux/arm64"

INFO="[INFO]"
ERROR="[ERROR]"

function log() {
  echo "${INFO} $*"
}

function fail() {
  echo "${ERROR} $*" >&2
  exit 1
}

if ! command -v docker > /dev/null 2>&1; then
  fail "Docker is not installed or not in PATH."
fi

if [[ ! -d "${FRONTEND_DIR}" ]]; then
  fail "Frontend directory not found at ${FRONTEND_DIR}"
fi

# Ensure buildx builder is available and active
if ! docker buildx inspect mybuilder >/dev/null 2>&1; then
  log "Creating buildx builder 'mybuilder'..."
  docker buildx create --name mybuilder --use
  docker buildx inspect --bootstrap
else
  log "Using existing buildx builder 'mybuilder'"
  docker buildx use mybuilder
fi

log "Building and pushing multi-platform frontend image for: ${PLATFORMS}"
log "Target image: ${REMOTE_IMAGE_NAME}"

# Build and push multi-platform image in one command
docker buildx build \
  --platform "${PLATFORMS}" \
  --tag "${REMOTE_IMAGE_NAME}" \
  --push \
  "${FRONTEND_DIR}"

log "✅ Multi-platform frontend image published successfully"
log "Platforms: ${PLATFORMS}"
log "Image: ${REMOTE_IMAGE_NAME}"
