# HeatClip

Paste a YouTube link → HeatClip reads the video's **"most replayed" heatmap**, uses
AI to turn the hottest moments into hook-led clips, lets you fine-tune the timing on
the graph, and renders downloadable **1080×1920 vertical Shorts**.

Built for creators clipping their own long-form videos.

## How it works

1. **Analyze** (fast, no download) — `yt-dlp` extracts the heatmap (`[{start,end,value}]`,
   the repeated-views signal), metadata, and the transcript.
2. **Hooks** — heatmap peaks are refined into clip candidates. With an
   `ANTHROPIC_API_KEY`, Claude picks a start that opens on a strong hook line;
   without one, a transcript-snapped heuristic is used.
3. **Render** — for each chosen clip, `yt-dlp --download-sections` pulls only that
   range and `ffmpeg` reframes it to a vertical Short (scale-to-cover + center-crop).

```
frontend (Next.js) ── /api ──▶ backend (FastAPI)
   heatmap graph,                 analyze → yt-dlp + Claude
   drag handles,                  render  → yt-dlp section + ffmpeg  ──▶ storage/*.mp4
   download
```

## Requirements

- **ffmpeg** on PATH (`ffmpeg -version`)
- **Python 3.10+** recommended (3.9 works but yt-dlp deprecates it)
- **Node 18+**

## Run

### Backend
```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env          # optional: add ANTHROPIC_API_KEY for AI hooks
.venv/bin/uvicorn main:app --port 8009 --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev                   # http://localhost:3000
```
The frontend proxies `/api/*` and `/files/*` to the backend (`next.config.mjs`).
Point elsewhere with `NEXT_PUBLIC_API_URL`.

## API

| Method | Path            | Purpose                                         |
|--------|-----------------|-------------------------------------------------|
| POST   | `/analyze`      | `{url}` → heatmap + hook-led clip candidates    |
| POST   | `/render`       | `{url, clips:[{start,end}]}` → `{jobId}`         |
| GET    | `/jobs/{id}`    | job status + downloadable clip URLs             |
| GET    | `/files/...`    | rendered `.mp4` files                           |

## Notes / next steps

- **Heatmap fallback:** videos without a "most replayed" graph (newer/smaller) fall
  back to transcript-suggested moments; the UI shows a notice.
- **yt-dlp fragility:** YouTube periodically breaks player clients; both `analyzer.py`
  and `renderer.py` try a client fallback chain (`android` first). Keep yt-dlp updated.
- **Jobs are in-memory** (process-local dict). Swap `jobs.py` for Redis/RQ for
  multi-worker/persistent rendering.
- **Storage cleanup:** rendered clips accumulate in `backend/storage/`; add a
  TTL/cleanup job before production.
- **Legal:** intended for creators clipping **their own** content — add Terms/consent
  before any public deployment.
- **Not in MVP:** burned-in captions (transcript is already fetched, so it's a natural
  fast-follow) and face/subject-tracking reframe (currently center-crop).
