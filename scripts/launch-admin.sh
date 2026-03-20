#!/bin/zsh
set -euo pipefail

ROOT_DIR="/System/Volumes/Data/.internal/projects/Projects/wireframes"
ADMIN_HOST="${ADMIN_HOST:-127.0.0.1}"
ADMIN_PORT="${ADMIN_PORT:-5173}"

cd "$ROOT_DIR"
set -a
source .env
set +a

cd admin
exec pnpm dev --host "$ADMIN_HOST" --port "$ADMIN_PORT"
