#!/usr/bin/env bash
set -euo pipefail

# Script is in /scripts/, so repo root is parent directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${REPO_ROOT}/docker-compose.prod.yml"
# The image name built by docker compose can vary. We'll attempt to find the built image
# from the compose output (preferred) or fallback to a local image name.
REMOTE_IMAGE_NAME="markomann/audio-transcription-frontend:latest"

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

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  fail "Cannot find ${COMPOSE_FILE}. Run this script from the repository root."
fi

log "Building frontend image via docker compose..."
if command -v docker > /dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose > /dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  fail "Neither 'docker compose' nor 'docker-compose' is available."
fi

"${COMPOSE_CMD[@]}" -f "${COMPOSE_FILE}" build frontend

IMAGE_ID=$("${COMPOSE_CMD[@]}" -f "${COMPOSE_FILE}" images --quiet frontend 2>/dev/null || true)

if [ -n "${IMAGE_ID}" ]; then
  log "Tagging image id ${IMAGE_ID} as ${REMOTE_IMAGE_NAME}"
  docker tag "${IMAGE_ID}" "${REMOTE_IMAGE_NAME}"
else
  LOCAL_IMAGE_NAME="transcribe-frontend:latest"
  log "Could not find compose image-id; attempting to tag local image ${LOCAL_IMAGE_NAME} as ${REMOTE_IMAGE_NAME}"
  if docker image inspect "${LOCAL_IMAGE_NAME}" >/dev/null 2>&1; then
    docker tag "${LOCAL_IMAGE_NAME}" "${REMOTE_IMAGE_NAME}"
  else
    fail "Unable to determine built image for frontend. Please build and tag manually."
  fi
fi

log "Pushing ${REMOTE_IMAGE_NAME} to Docker Hub..."
docker push "${REMOTE_IMAGE_NAME}"

log "✅ Publish complete."
