export interface HeatMarker {
  start: number;
  end: number;
  value: number;
}

export interface Candidate {
  start: number;
  end: number;
  hotStart: number;
  hotEnd: number;
  hookText: string;
  score: number;
  source: string;
  reason: string;
}

export interface AnalyzeResult {
  videoId: string;
  title: string;
  duration: number;
  thumbnail: string | null;
  channel: string | null;
  webpageUrl: string;
  maxHeight: number;
  hasHeatmap: boolean;
  heatmap: HeatMarker[];
  candidates: Candidate[];
}

export interface User {
  email: string;
  name: string;
  plan: string; // free | creator | studio | admin
}

export interface ClipResult {
  index: number;
  start: number;
  end: number;
  status: string;
  clip_url: string | null;
  error: string | null;
}

export interface JobStatus {
  jobId: string;
  status: string;
  progress: { done: number; total: number };
  error: string | null;
  clips: ClipResult[];
}

async function jsonOrThrow(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || `Request failed (${res.status})`);
  return body;
}

export async function analyze(url: string): Promise<AnalyzeResult> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  return jsonOrThrow(res);
}

export async function render(
  url: string,
  clips: { start: number; end: number }[],
  quality: string = "1080p",
  autoFrame: boolean = true,
  reframeNudge: number = 0
): Promise<{ jobId: string }> {
  const token = getToken();
  const res = await fetch("/api/render", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ url, clips, quality, autoFrame, reframeNudge }),
  });
  return jsonOrThrow(res);
}

export async function getJob(jobId: string): Promise<JobStatus> {
  const res = await fetch(`/api/jobs/${jobId}`);
  return jsonOrThrow(res);
}

/* ---------------- auth + contact ---------------- */

const TOKEN_KEY = "hc_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setToken(t: string) {
  try {
    localStorage.setItem(TOKEN_KEY, t);
  } catch {
    /* ignore */
  }
}
export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export async function signup(
  email: string,
  password: string,
  name: string
): Promise<{ token: string; user: User }> {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  const body = await jsonOrThrow(res);
  setToken(body.token);
  return body;
}

export async function login(
  email: string,
  password: string
): Promise<{ token: string; user: User }> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await jsonOrThrow(res);
  setToken(body.token);
  return body;
}

export async function me(): Promise<User | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.user as User;
  } catch {
    return null;
  }
}

export async function sendContact(payload: {
  name: string;
  email: string;
  topic: string;
  message: string;
}): Promise<void> {
  const res = await fetch("/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  await jsonOrThrow(res);
}
