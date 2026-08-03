# HeatClip backend — FastAPI + yt-dlp + ffmpeg.
# Python 3.12 (yt-dlp deprecates 3.9); ffmpeg from Debian.
FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir --upgrade yt-dlp  # always ship the newest extractor

COPY . .

# Persisted data (SQLite, session secret, rendered clips) lives here — mount a volume.
ENV HEATCLIP_DATA=/data
RUN mkdir -p /data

EXPOSE 8009
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8009"]
