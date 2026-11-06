#!/bin/bash
# Double-click on a Mac to start Jeff 2 (and Jeff, if JEFF_DIR is set in .env).
# Close this window to stop everything.

cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install it from https://nodejs.org (LTS), then double-click this file again."
  read -r -p "Press Enter to close."; exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created a settings file (.env). Opening it — add your key, save, close, then double-click this file again."
  open -e .env
  read -r -p "Press Enter to close."; exit 0
fi

set -a; . ./.env; set +a
PORT="${PORT:-8000}"
BRIDGE_PID=""

if [ -n "$JEFF_DIR" ]; then
  if ! command -v uv >/dev/null 2>&1; then
    echo "Jeff needs 'uv'. Install it with:  curl -LsSf https://astral.sh/uv/install.sh | sh   — then try again."
    read -r -p "Press Enter to close."; exit 1
  fi
  echo "Starting Jeff (the first time it downloads the model, ~1.7 GB)..."
  JEFF_BACKEND=mlx uv run --project "$JEFF_DIR" python "$PWD/jeff-bridge/bridge.py" &
  BRIDGE_PID=$!
  for _ in $(seq 1 600); do
    curl -s http://localhost:8790/health >/dev/null 2>&1 && break
    kill -0 "$BRIDGE_PID" 2>/dev/null || { echo "Jeff failed to start (see messages above). Continuing without Jeff."; BRIDGE_PID=""; break; }
    sleep 1
  done
  [ -n "$BRIDGE_PID" ] && export JEFF_URL="http://localhost:8790/classify"
fi

trap '[ -n "$BRIDGE_PID" ] && kill "$BRIDGE_PID" 2>/dev/null' EXIT
( sleep 2; open "http://localhost:$PORT/web/" ) &
node server/server.mjs
