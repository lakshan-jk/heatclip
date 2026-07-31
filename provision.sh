#!/usr/bin/env bash
#
# HeatClip one-command deploy for a fresh Ubuntu/Debian VPS. Run as root.
#
#   Usage:  ./provision.sh yourdomain.com
#
# First run (no .env) creates .env with a generated secret and your domain,
# installs Docker if needed, then builds and launches the whole stack behind
# Caddy (automatic HTTPS). Re-run any time to update after code changes.
#
set -euo pipefail

cd "$(dirname "$0")"
DOMAIN_ARG="${1:-}"

echo "==> HeatClip deploy"

# 1. Docker (+ compose plugin)
if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker…"
  curl -fsSL https://get.docker.com | sh
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: Docker Compose plugin missing. Install docker-compose-plugin and retry." >&2
  exit 1
fi

# 2. .env — create with a strong secret on first run
if [ ! -f .env ]; then
  echo "==> Creating .env"
  cp .env.example .env
  SECRET="$(openssl rand -hex 32)"
  sed -i "s|^HEATCLIP_SECRET=.*|HEATCLIP_SECRET=${SECRET}|" .env
fi

# 3. Domain — from arg or existing .env
if [ -n "$DOMAIN_ARG" ]; then
  sed -i "s|^DOMAIN=.*|DOMAIN=${DOMAIN_ARG}|" .env
fi
DOMAIN_SET="$(grep '^DOMAIN=' .env | cut -d= -f2)"
if [ -z "$DOMAIN_SET" ] || [ "$DOMAIN_SET" = "heatclip.example.com" ]; then
  echo ""
  echo "Set your domain first:"
  echo "    ./provision.sh yourdomain.com"
  echo "(and make sure its DNS A record points at this server)"
  exit 1
fi

# 4. Launch
echo "==> Building & starting (this pulls ffmpeg + builds both images the first time)…"
docker compose up -d --build

echo ""
echo "==> Done. HeatClip is starting at: https://${DOMAIN_SET}"
echo "    Caddy issues the TLS certificate on first request (DNS must resolve)."
echo "    Logs:   docker compose logs -f"
echo "    Update: git pull && ./provision.sh"
