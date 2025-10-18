#!/usr/bin/env bash
set -euo pipefail

# Script is in /scripts/, so repo root is parent directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

BACKEND_SCRIPT="${SCRIPT_DIR}/publish_backend.sh"
FRONTEND_SCRIPT="${SCRIPT_DIR}/publish_frontend.sh"

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
