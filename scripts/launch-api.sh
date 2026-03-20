#!/bin/zsh
set -euo pipefail

ROOT_DIR="/System/Volumes/Data/.internal/projects/Projects/wireframes"

cd "$ROOT_DIR"
set -a
source .env
set +a

cd api
exec bun run src/index.ts
