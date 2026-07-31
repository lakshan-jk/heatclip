# Turning HeatClip into a paid product

The pricing page (Free / Creator / Studio) and auth already exist. To actually
charge money you need three things: **payments**, **plan enforcement**, and the
**legal basics**. Here's the concrete path mapped to this codebase.

## 1. Payments — pick a processor

| Option | Why | Notes |
|--------|-----|-------|
| **Lemon Squeezy / Polar** (recommended to start) | Merchant of Record — they handle global **sales tax / EU VAT** for you | Simplest for a solo seller; Polar is open-source-friendly |
| **Stripe** | Most control, lowest fees | You're responsible for tax (add Stripe Tax) |

All three are hosted checkout + webhooks, so the wiring is the same shape.

### Backend wiring (in `backend/`)
1. Add a `plan` column to users:
   ```sql
   ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free';
   ```
   (add to `db.py` `init_db()` and return it from `auth.user_from_token`).
2. New `billing.py` + endpoints in `main.py`:
   - `POST /billing/checkout` → create a hosted checkout session for the chosen
     plan, return its URL. Frontend redirects there.
   - `POST /billing/webhook` → verify the signature, and on
     `checkout.completed` / `subscription.updated` set `users.plan`; on
     cancel/expire set it back to `free`.
3. Secrets via env (already have the pattern): `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET` (or the Lemon/Polar equivalents) in `.env` +
   `docker-compose.yml`.

### Frontend wiring (in `frontend/`)
- Pricing "Go Creator/Studio" buttons (`components/site/Pricing.tsx`) → call
  `/api/billing/checkout` and `window.location = url`.
- Show current plan in the app bar (extend `me()` to return `plan`).

## 2. Enforce the plan (server-side — never trust the client)
Gate in `main.py` `render_endpoint` using the caller's plan:

| Limit | Free | Creator | Studio |
|-------|------|---------|--------|
| Videos / month | 3 | ∞ | ∞ |
| Max quality | 720p | 1080p | 4K |
| Watermark | yes | no | no |

- **Quality cap:** reject/clamp `quality` above the plan's max in `render_endpoint`.
- **Monthly limit:** add a `renders(user, month)` count in `db.py`; check before
  enqueuing.
- **Watermark (free tier):** add a drawtext overlay in `renderer.py`'s filter, e.g.
  append `,drawtext=text='HeatClip':x=w-tw-20:y=h-th-30:fontcolor=white@0.6:fontsize=36`.
- The UI already shows Free=720p / Creator=1080p / Studio=4K on the pricing page —
  add a small **Pro** lock on 2K/4K quality chips for free users as an upsell.

Authenticate `/render` by reading the `Authorization: Bearer` token (reuse
`auth.user_from_token`) so limits attach to a real account.

## 3. Legal basics (do before charging)
- **/terms** and **/privacy** pages (simple static pages under `app/terms`,
  `app/privacy`) — link them from the footer (footer already has Legal slots).
- **YouTube usage:** position HeatClip for creators clipping **their own**
  content. Add that to Terms and a short in-product note. Provide a **DMCA /
  contact** address (your `/support` page already collects messages).
- **Refunds & billing terms** in Terms; a MoR (Lemon/Polar) covers invoices/VAT.

## 4. Nice-to-haves that help sales
- **OSS analytics:** self-host **Plausible** or **Umami** (both open-source) —
  add as another `docker-compose` service. No cookies banner needed.
- **Transactional email:** self-host or use a cheap SMTP for password resets +
  "your Shorts are ready" (the contact form already stores to SQLite).
- **Watermark → upgrade prompt:** free renders link back to a pricing modal.

## What I can implement now vs. what needs your keys
- ✅ Now (no keys): `plan` column + enforcement scaffolding, quality caps,
  watermark filter, Terms/Privacy pages, Pro badges, plan in `me()`.
- 🔑 Needs your account: the actual Stripe/Lemon/Polar keys + webhook secret to
  finish checkout.

Say the word and I'll build the ✅ items and stub the checkout so it's one env
var away from live.
