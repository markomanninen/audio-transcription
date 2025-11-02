#!/usr/bin/env bash
set -euo pipefail

# Multi-platform backend image publisher using buildx
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${REPO_ROOT}/backend"

# Default to CPU variant (faster builds, smaller images)
# Use TORCH_VARIANT=cuda for GPU support
TORCH_VARIANT="${TORCH_VARIANT:-cpu}"

# Image naming based on variant
if [ "$TORCH_VARIANT" = "cuda" ]; then
  REMOTE_IMAGE_NAME="markomann/audio-transcription-backend:latest-cuda"
  PLATFORMS="linux/amd64"  # CUDA typically only needed on amd64
else
  REMOTE_IMAGE_NAME="markomann/audio-transcription-backend:latest"
  PLATFORMS="linux/amd64,linux/arm64"
fi

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

if [[ ! -d "${BACKEND_DIR}" ]]; then
  fail "Backend directory not found at ${BACKEND_DIR}"
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

log "Building and pushing multi-platform backend image"
log "PyTorch variant: ${TORCH_VARIANT}"
log "Platforms: ${PLATFORMS}"
log "Target image: ${REMOTE_IMAGE_NAME}"

# Build and push multi-platform image in one command
# --push publishes directly to registry
# --platform specifies target architectures
# --build-arg passes PyTorch variant to Dockerfile
docker buildx build \
  --platform "${PLATFORMS}" \
  --build-arg TORCH_VARIANT="${TORCH_VARIANT}" \
  --tag "${REMOTE_IMAGE_NAME}" \
  --push \
  "${BACKEND_DIR}"

log "✅ Multi-platform backend image published successfully"
log "PyTorch variant: ${TORCH_VARIANT}"
log "Platforms: ${PLATFORMS}"
log "Image: ${REMOTE_IMAGE_NAME}"
