#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${REPO_ROOT}/docker-compose.prod.yml"
LOCAL_IMAGE_NAME="transcribe-backend:latest"
REMOTE_IMAGE_NAME="markomann/audio-transcription-backend:latest"

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

log "Building backend image via docker compose..."
docker compose -f "${COMPOSE_FILE}" build backend

log "Tagging ${LOCAL_IMAGE_NAME} as ${REMOTE_IMAGE_NAME}..."
docker tag "${LOCAL_IMAGE_NAME}" "${REMOTE_IMAGE_NAME}"

log "Pushing ${REMOTE_IMAGE_NAME} to Docker Hub..."
docker push "${REMOTE_IMAGE_NAME}"

log "✅ Publish complete."
