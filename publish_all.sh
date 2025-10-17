#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BACKEND_SCRIPT="${REPO_ROOT}/publish_backend.sh"
FRONTEND_SCRIPT="${REPO_ROOT}/publish_frontend.sh"

if [[ ! -x "${BACKEND_SCRIPT}" ]]; then
  echo "[ERROR] Missing or non-executable ${BACKEND_SCRIPT}" >&2
  exit 1
fi

if [[ ! -x "${FRONTEND_SCRIPT}" ]]; then
  echo "[ERROR] Missing or non-executable ${FRONTEND_SCRIPT}" >&2
  exit 1
fi

"${BACKEND_SCRIPT}"
"${FRONTEND_SCRIPT}"

echo "[INFO] ✅ Backend and frontend images published."
