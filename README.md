# Elevate Education Hub

A full-stack education management platform with lesson plan AI, billing, enrollments, coaching, and gradebook features.

**Stack:** React + Vite (frontend) · Express.js (backend) · Neon PostgreSQL · OpenAI

---

## Local Development

### Prerequisites

- Node.js 18+
- A PostgreSQL database ([Neon](https://neon.tech) recommended)
- An OpenAI API key (for AI lesson plan features)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/your-org/elevate-education-hub1.git
cd elevate-education-hub1

# 2. Install dependencies
npm install

# 3. Set environment variables
cp .env.local.example .env.local
# Edit .env.local — fill in DATABASE_URL, ADMIN_TOKEN, ADMIN_PASSWORD, JWT_SECRET, SESSION_SECRET, OPENAI_API_KEY

# 4. Start the backend (port 3001)
npm run dev

# 5. In a second terminal, start the frontend (port 5173)
npm run dev:frontend
```

Open http://localhost:5173.

---

## Deployment on Vercel

### 1. Push to GitHub

```bash
git checkout main
git merge your-feature-branch
git push origin main
```

### 2. Import into Vercel

- Go to [vercel.com](https://vercel.com) → **Add New Project** → import the GitHub repo
- Vercel detects `vercel.json` automatically — no manual framework config needed
- Leave framework as **Other**

### 3. Add required environment variables

In Vercel dashboard → **Settings → Environment Variables**:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `ADMIN_TOKEN` | Secret token for admin bootstrap |
| `ADMIN_PASSWORD` | Initial admin account password |
| `JWT_SECRET` | Random 32+ character string |
| `SESSION_SECRET` | Random 32+ character string |
| `OPENAI_API_KEY` | From platform.openai.com — used server-side only |

### 4. Add optional environment variables

| Variable | Default | Description |
|---|---|---|
| `OPENAI_MODEL_FAST` | `gpt-4o-mini` | Model for fast tasks (support enhancement, assessments, exit tickets) |
| `OPENAI_MODEL_QUALITY` | `gpt-4o` | Model for full lesson enhancement |
| `STRIPE_SECRET_KEY` | — | Stripe secret key (billing features) |
| `STRIPE_WEBHOOK_SECRET` | — | From Stripe webhook dashboard |
| `STRIPE_PUBLISHABLE_KEY` | — | Stripe publishable key |
| `SENDGRID_API_KEY` | — | SendGrid API key (email features) |
| `FROM_EMAIL` | — | Sender address for system emails |
| `APP_URL` | — | Your deployment URL, e.g. `https://your-app.vercel.app` |

**AI model notes:**
- `OPENAI_MODEL_FAST` is used for smaller tasks: EL/SPED/IDEA support improvements, assessment generation, exit tickets. Defaults to `gpt-4o-mini` — fast and cost-effective (~$0.001/call).
- `OPENAI_MODEL_QUALITY` is used for full lesson enhancement only. Defaults to `gpt-4o` — higher quality output for the most demanding curriculum task (~$0.05/call).
- To change models without a code deploy, update these vars in Vercel and redeploy.

### 5. Deploy

Click **Deploy**. The first deploy takes ~2 minutes. Database tables are created and seeded automatically on cold start.

---

## Security notes

- `OPENAI_API_KEY` is read only in `server/routes/lessonAI.js` via `server/lib/openai-config.js`. It is never sent to the browser and has no `VITE_` prefix.
- The frontend calls `/api/lesson-ai/enhance-supports` or `/api/lesson-ai/enhance-lesson` — the server makes the OpenAI request and returns only the result.
- Model selection is centralised in `server/lib/openai-config.js`. No model names appear in route files.
- No Supabase dependency. The only database connection is `DATABASE_URL` (Neon PostgreSQL via Drizzle ORM).

---

## Revenue recognition cron

The monthly revenue recognition job is disabled on Vercel (no persistent process). Trigger it manually:

```
POST /api/accounting/recognize-revenue
{ "period": "2025-01" }
```

Or add a Vercel Cron entry in `vercel.json`:

```json
"crons": [{ "path": "/api/accounting/recognize-revenue", "schedule": "0 2 1 * *" }]
```

---

## Project structure

```
├── api/
│   └── index.js          # Vercel serverless entry point
├── server/
│   ├── app.js            # Express app (routes, middleware, startup migrations)
│   ├── index.js          # Local dev server (app.listen)
│   ├── routes/           # API route handlers
│   ├── services/         # Business logic (stripe, email, accounting, AI)
│   └── schema.js         # Drizzle ORM schema
├── src/
│   ├── pages/            # React pages (admin, parent, coach portals)
│   ├── components/       # Shared UI components
│   └── types/            # TypeScript interfaces
├── .env.local.example    # Environment variable template
└── vercel.json           # Vercel deployment config
```
