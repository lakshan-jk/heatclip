"""Smart auto-reframe: track the speaker's face across a clip and build an ffmpeg
filter that pans/zooms a 9:16 window to keep them framed and filling the frame.

Returns an ffmpeg `-vf` string (sendcmd-driven crop → scale) when a face is found
often enough, otherwise None so the caller falls back to a plain center-crop.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

_CASCADE = cv2.CascadeClassifier(
    os.path.join(cv2.data.haarcascades, "haarcascade_frontalface_default.xml")
)

SAMPLE_FPS = 4.0        # detections per second
DETECT_WIDTH = 640      # downscale frames to this width for fast detection
FACE_TARGET = 0.32      # desired face height as a fraction of the crop height
MIN_CROP_FRAC = 0.25    # never zoom tighter than this fraction of source height
FACE_Y_IN_CROP = 0.42   # keep the face a little above the crop's center
KEYFRAME_FPS = 10.0     # how densely we emit pan keyframes (smoothness)
SMOOTH_WIN = 7          # moving-average window over keyframes


def _detect(src: Path):
    cap = cv2.VideoCapture(str(src))
    if not cap.isOpened():
        return None
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if W <= 0 or H <= 0:
        cap.release()
        return None
    step = max(1, int(round(fps / SAMPLE_FPS)))
    scale = DETECT_WIDTH / W if W > DETECT_WIDTH else 1.0
    inv = 1.0 / scale

    ts, cxs, cys, fhs = [], [], [], []
    n_samples = 0
    i = 0
    while True:
        if not cap.grab():
            break
        if i % step == 0:
            n_samples += 1
            ok, frame = cap.retrieve()
            if ok:
                small = (
                    cv2.resize(frame, None, fx=scale, fy=scale)
                    if scale < 1.0
                    else frame
                )
                gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
                faces = _CASCADE.detectMultiScale(gray, 1.15, 5, minSize=(24, 24))
                if len(faces):
                    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
                    ts.append(i / fps)
                    cxs.append((x + w / 2) * inv)
                    cys.append((y + h / 2) * inv)
                    fhs.append(h * inv)
        i += 1
    dur = i / fps if fps else 0.0
    cap.release()
    return W, H, dur, n_samples, ts, cxs, cys, fhs


def reframe_filter(
    src: Path, out_w: int, out_h: int, workdir: Path, nudge: float = 0.0
) -> Optional[str]:
    """`nudge` shifts the crop horizontally, as a fraction of source width
    (-0.2 = left, +0.2 = right) — used to correct which subject/region is framed."""
    try:
        res = _detect(src)
    except Exception:  # noqa: BLE001 - any cv2 failure → fall back
        return None
    if not res:
        return None
    W, H, dur, n_samples, ts, cxs, cys, fhs = res

    # Need faces in a meaningful share of the clip, else center-crop is safer.
    if len(ts) < 3 or n_samples == 0 or len(ts) / n_samples < 0.25:
        return None

    med_fh = float(np.median(fhs))
    if med_fh <= 0:
        return None

    # Crop size (fixed per clip) — zoom so the face is a comfortable fraction.
    crop_h = med_fh / FACE_TARGET
    crop_h = max(H * MIN_CROP_FRAC, min(float(H), crop_h))
    crop_w = crop_h * out_w / out_h
    if crop_w > W:  # source too narrow to make a 9:16 window → let center-crop handle
        return None
    crop_h_i, crop_w_i = int(round(crop_h)), int(round(crop_w))

    # Dense, smoothed pan track across the whole clip.
    kf_t = np.arange(0.0, max(dur, ts[-1]) + 1e-3, 1.0 / KEYFRAME_FPS)
    cx = np.interp(kf_t, ts, cxs)
    cy = np.interp(kf_t, ts, cys)
    if len(kf_t) >= SMOOTH_WIN:
        k = np.ones(SMOOTH_WIN) / SMOOTH_WIN
        cx = np.convolve(cx, k, mode="same")
        cy = np.convolve(cy, k, mode="same")

    x0 = np.clip(cx - crop_w / 2 + nudge * W, 0, W - crop_w_i)
    y0 = np.clip(cy - crop_h * FACE_Y_IN_CROP, 0, H - crop_h_i)

    # Write timed crop commands for sendcmd.
    lines = []
    for t, xx, yy in zip(kf_t, x0, y0):
        lines.append(f"{t:.3f} crop x {int(round(xx))};")
        lines.append(f"{t:.3f} crop y {int(round(yy))};")
    cmd_file = workdir / "reframe.cmd"
    cmd_file.write_text("\n".join(lines))

    return (
        f"setpts=PTS-STARTPTS,"
        f"sendcmd=f='{cmd_file.as_posix()}',"
        f"crop={crop_w_i}:{crop_h_i}:{int(round(x0[0]))}:{int(round(y0[0]))},"
        f"scale={out_w}:{out_h},setsar=1,fps=30"
    )
