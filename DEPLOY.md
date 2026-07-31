# Deploying HeatClip (100% open-source)

HeatClip self-hosts with Docker Compose behind [Caddy](https://caddyserver.com),
which gets you **automatic HTTPS** on your own domain. No proprietary PaaS, no
vendor lock-in. The whole stack is OSS:

| Piece            | Project        | License        |
|------------------|----------------|----------------|
| Reverse proxy    | Caddy          | Apache-2.0     |
| Frontend         | Next.js/React  | MIT            |
| Backend API      | FastAPI/uvicorn| MIT            |
| Database         | SQLite         | Public domain  |
| Video fetch      | yt-dlp         | Unlicense      |
| Media encode     | ffmpeg         | LGPL/GPL       |
| Containers       | Docker         | Apache-2.0     |

## What you need
- A Linux server (any VPS: Hetzner, DigitalOcean, a home box, etc.)
- Docker + the Compose plugin — the only host dependency
- A domain name

## 1. Point your domain at the server
Create a DNS **A record** for your domain (e.g. `heatclip.example.com`) pointing
to the server's public IP. Open ports **80** and **443**.

## 2. Configure
```bash
git clone <your-repo> heatclip && cd heatclip
cp .env.example .env
# edit .env:
#   DOMAIN=heatclip.example.com
#   HEATCLIP_SECRET=$(openssl rand -hex 32)
#   ANTHROPIC_API_KEY=...        # optional, enables AI hooks
```

## 3. Launch
```bash
docker compose up -d --build
```
Caddy provisions a Let's Encrypt certificate automatically on first request.
Visit `https://your-domain` — done.

```bash
docker compose logs -f       # watch logs
docker compose down          # stop
docker compose up -d --build # update after code changes
```

## Local test (no domain)
Set `DOMAIN=localhost` in `.env`, then `docker compose up --build` and open
`https://localhost` (accept the self-signed cert) or `http://localhost`.

## How routing works
All traffic hits Caddy on one domain:
- `/api/*`  → backend (prefix stripped, so it sees `/analyze`, `/auth/login`, …)
- `/files/*`→ backend (rendered `.mp4` clips)
- everything else → the Next.js app

So the browser only ever talks to your domain — no CORS, no exposed backend port.

## Data & backups
Everything persistent lives in the `heatclip_data` Docker volume:
- `heatclip.db` — users + contact messages (SQLite)
- `.secret` — the auth signing key
- `storage/` — rendered clips

Back it up with:
```bash
docker run --rm -v heatclip_heatclip_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/heatclip-data.tgz -C /data .
```
TLS certificates persist in the `caddy_data` volume.

## Scaling notes
- Rendering (ffmpeg) is CPU-heavy and runs in the backend process via
  FastAPI `BackgroundTasks`. For higher volume, move jobs to Redis + RQ workers
  (swap `backend/jobs.py`) and run multiple `backend` replicas.
- Rendered clips accumulate in the volume — add a cron/TTL cleanup for
  `storage/` before heavy production use.
- Keep `yt-dlp` current (`pip install -U yt-dlp` / rebuild) since YouTube
  changes periodically break extraction.
