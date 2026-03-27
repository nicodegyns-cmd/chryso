#!/usr/bin/env bash
set -euo pipefail

# Run from project root
cd "$(dirname "$0")"

# Load .env if present
set -a
if [ -f .env ]; then
  # shellcheck disable=SC1091
  source .env
fi
set +a

# Defaults
export DB_CLIENT=${DB_CLIENT:-pg}
export NODE_ENV=${NODE_ENV:-production}
PORT=${PORT:-3000}

# Install deps if needed
if [ ! -d node_modules ] || [ ! -x node_modules/.bin/next ]; then
  echo "Installing dependencies..."
  npm install --no-audit --no-fund
fi

# Build if missing
if [ ! -f .next/BUILD_ID ]; then
  echo "Building app..."
  npm run build
fi

# Start with local Next binary (npx prefers local bin)
if command -v npx >/dev/null 2>&1; then
  exec npx next start -p "$PORT"
else
  exec node node_modules/next/dist/bin/next start -p "$PORT"
fi
