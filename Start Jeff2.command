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
# Let Node use the same proxy/VPN settings as curl (HTTPS_PROXY etc.), if any are set
export NODE_USE_ENV_PROXY=1
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

TUNNEL_PID=""
cleanup() {
  [ -n "$BRIDGE_PID" ] && kill "$BRIDGE_PID" 2>/dev/null
  [ -n "$TUNNEL_PID" ] && kill "$TUNNEL_PID" 2>/dev/null
}
trap cleanup EXIT

if [ "$SHARE" = "yes" ]; then
  if [ -z "$SITE_PASSWORD" ]; then
    echo "SHARE=yes needs a team password. Add SITE_PASSWORD=... to .env, then start again."
    read -r -p "Press Enter to close."; exit 1
  fi
  if ! command -v cloudflared >/dev/null 2>&1; then
    echo "Sharing needs 'cloudflared'. Install it with:  brew install cloudflared   — then start again."
    read -r -p "Press Enter to close."; exit 1
  fi
fi

node --use-system-ca server/server.mjs &
SERVER_PID=$!
sleep 2
open "http://localhost:$PORT/web/"

if [ "$SHARE" = "yes" ]; then
  TUNNEL_LOG="$(mktemp)"
  cloudflared tunnel --no-autoupdate --url "http://localhost:$PORT" >"$TUNNEL_LOG" 2>&1 &
  TUNNEL_PID=$!
  LINK=""
  for _ in $(seq 1 30); do
    LINK="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -1)"
    [ -n "$LINK" ] && break
    sleep 1
  done
  echo
  if [ -n "$LINK" ]; then
    echo "=============================================================="
    echo "  TEAM LINK:      $LINK/web/"
    echo "  Team password:  (the SITE_PASSWORD in your .env)"
    echo "  Works while this window stays open and your Mac stays awake."
    echo "  The link changes every time you restart."
    echo "=============================================================="
    echo "$LINK/web/" | pbcopy && echo "  (Link copied — paste it to your team.)"
  else
    echo "Could not create the share link. Details: $TUNNEL_LOG"
  fi
  echo
fi

# keep the Mac awake while sharing, and run until this window closes
if [ "$SHARE" = "yes" ]; then caffeinate -i -w "$SERVER_PID" & fi
wait "$SERVER_PID"
