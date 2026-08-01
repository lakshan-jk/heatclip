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

# 2. .env — create with strong production secrets on first run
NEW_ADMIN_PW=""
if [ ! -f .env ]; then
  echo "==> Creating .env with generated secrets"
  cp .env.example .env
  sed -i "s|^HEATCLIP_SECRET=.*|HEATCLIP_SECRET=$(openssl rand -hex 32)|" .env
  NEW_ADMIN_PW="$(openssl rand -base64 15)"
  sed -i "s|^HEATCLIP_ADMIN_PASSWORD=.*|HEATCLIP_ADMIN_PASSWORD=${NEW_ADMIN_PW}|" .env
fi

# 3. Domain — from arg or existing .env; also lock CORS to that domain
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
sed -i "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=https://${DOMAIN_SET}|" .env

# 4. Launch
echo "==> Building & starting (this pulls ffmpeg + builds both images the first time)…"
docker compose up -d --build

echo ""
echo "==> Done. HeatClip is starting at: https://${DOMAIN_SET}"
echo "    Caddy issues the TLS certificate on first request (DNS must resolve)."
if [ -n "$NEW_ADMIN_PW" ]; then
  ADMIN_EMAIL_SET="$(grep '^HEATCLIP_ADMIN_EMAIL=' .env | cut -d= -f2)"
  echo ""
  echo "    ┌─────────────────────────────────────────────────────────────┐"
  echo "    │ ADMIN LOGIN (save this — shown once):                        │"
  echo "    │   email:    ${ADMIN_EMAIL_SET}"
  echo "    │   password: ${NEW_ADMIN_PW}"
  echo "    └─────────────────────────────────────────────────────────────┘"
fi
echo "    Logs:   docker compose logs -f"
echo "    Update: git pull && ./provision.sh"
