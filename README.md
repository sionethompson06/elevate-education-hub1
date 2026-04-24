# Elevate Education Hub

A full-stack education management platform (React + Vite frontend, Express backend) with lesson plan AI, billing, enrollments, coaching, and gradebook features.

---

## Local Development

### Prerequisites

- Node.js 18+
- A PostgreSQL database (e.g. [Neon](https://neon.tech))
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
# Edit .env.local — at minimum set DATABASE_URL, ADMIN_TOKEN, ADMIN_PASSWORD

# 4. Start the backend (port 3001)
npm run dev

# 5. In a second terminal, start the frontend (port 5173)
npm run dev:frontend
```

Open http://localhost:5173.

---

## Deployment on Vercel

### One-time setup

1. Push this repository to GitHub.
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import the GitHub repo.
3. Vercel auto-detects the `vercel.json` configuration:
   - **Build command**: `npm run build` (Vite)
   - **Output directory**: `dist`
   - **API routes**: `/api/*` → `api/index.js` (Express as a serverless function)
4. Add environment variables in the Vercel dashboard (**Settings → Environment Variables**):

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Neon or other PostgreSQL connection string |
| `ADMIN_TOKEN` | Yes | Secret token for admin bootstrap |
| `ADMIN_PASSWORD` | Yes | Initial admin account password |
| `OPENAI_API_KEY` | Yes (AI features) | Never expose with `VITE_` prefix |
| `STRIPE_SECRET_KEY` | Yes (billing) | |
| `STRIPE_WEBHOOK_SECRET` | Yes (billing) | From Stripe webhook dashboard |
| `STRIPE_PUBLISHABLE_KEY` | Yes (billing) | Frontend-safe — prefix with `VITE_` if used in Vite |
| `APP_URL` | Yes | Your Vercel deployment URL, e.g. `https://your-app.vercel.app` |
| `SENDGRID_API_KEY` | Yes (email) | |
| `FROM_EMAIL` | Yes (email) | |
| `SESSION_SECRET` | Yes | Random 32+ char string |
| `JWT_SECRET` | Yes | Random 32+ char string |

5. Click **Deploy**.

### Notes

- **Revenue recognition cron**: The monthly revenue recognition job (`cron.schedule`) is automatically disabled on Vercel (detected via `process.env.VERCEL`). Trigger it manually via `POST /api/accounting/recognize-revenue` with `{ period: "YYYY-MM" }` from the Admin → Financial Reports tab, or set up a Vercel Cron Job in `vercel.json` pointing to that endpoint.
- **Startup migrations**: Database table creation, seeding, and data migrations run on every cold start — they are all idempotent and safe to re-run.
- **OpenAI key**: The key is read from `process.env.OPENAI_API_KEY` server-side only. It is never sent to the browser. The frontend only calls `/api/lesson-ai/enhance-supports`.

### Vercel Cron (optional — replaces node-cron)

To run revenue recognition automatically on Vercel, add a cron entry to `vercel.json`:

```json
"crons": [
  {
    "path": "/api/accounting/recognize-revenue",
    "schedule": "0 2 1 * *"
  }
]
```

The endpoint already exists and accepts a `period` param; without a body it defaults to the previous calendar month.

---

## Project Structure

```
├── api/
│   └── index.js          # Vercel serverless entry point (exports Express app)
├── server/
│   ├── app.js            # Express app (routes, middleware, startup migrations)
│   ├── index.js          # Local dev server (calls app.listen())
│   ├── routes/           # API route handlers
│   ├── services/         # Business logic (stripe, email, accounting, AI)
│   └── schema.js         # Drizzle ORM schema
├── src/
│   ├── pages/            # React pages (admin, parent, coach portals)
│   ├── components/       # Shared UI components
│   └── types/            # TypeScript interfaces
├── .env.local.example    # Template for environment variables
└── vercel.json           # Vercel deployment config
```
