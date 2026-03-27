# Elevate Education Hub

## Overview
A comprehensive multi-role educational platform for Elevate Performance Academy. Includes a public-facing website and separate portals for students, parents, academic coaches, performance coaches, and admins.

## Tech Stack
- **Frontend**: React 18 + Vite, Tailwind CSS, shadcn/ui components
- **Routing**: react-router-dom v6
- **State/Data**: @tanstack/react-query v5
- **Charts**: Recharts
- **Payments**: Stripe (@stripe/react-stripe-js)
- **Animations**: Framer Motion
- **Icons**: lucide-react

## Architecture
- **Single-page app** — Vite dev server on port 5000
- **API client**: `src/api/base44Client.js` — in-memory entity store with CRUD operations and demo auth (replaces Base44 SDK)
- **Auth**: `src/lib/AuthContext.jsx` — localStorage-based auth with demo login
- **RBAC**: `src/lib/rbac.js` + `src/lib/RBACGuard.jsx` — role-based route protection

## Roles
- `admin` — full access, can view all hubs
- `student` — student portal
- `parent` — parent portal (billing, enrollment, progress)
- `academic_coach` — academic coaching portal
- `performance_coach` — athletic coaching portal

## Key Files
- `src/App.jsx` — all route definitions
- `src/api/base44Client.js` — API client (entity CRUD, auth, functions)
- `src/lib/AuthContext.jsx` — auth provider
- `src/lib/rbac.js` — role definitions, route permissions
- `src/lib/RBACGuard.jsx` — route guard component
- `src/components/layout/PortalLayout.jsx` — sidebar layout for all portal roles
- `src/components/layout/PublicLayout.jsx` — public page layout (nav + footer)
- `src/components/layout/PublicNav.jsx` — public navigation bar
- `src/pages/Login.jsx` — login page with demo role shortcuts

## Page Structure
- `/` — Public homepage
- `/login` — Sign in page
- `/apply` — Application form
- `/student/*` — Student portal (dashboard, schedule, progress, attendance, messages, resources, rewards)
- `/parent/*` — Parent portal (dashboard, programs, payments, progress, schedule, attendance, messages, resources)
- `/academic-coach/*` — Academic coach portal
- `/performance-coach/*` — Performance coach portal
- `/admin/*` — Admin portal (dashboard, users, students, parents, admissions, enrollments, attendance, rewards, messages, resources, analytics, CMS, access logs)

## Design
- Primary color: `#1a3c5e` (dark navy blue)
- Accent: `#f59e0b` (yellow/amber)
- Consistent card/badge UI patterns across portals

## Demo Login
Visit `/login` and use quick-access role buttons. Email prefix determines role:
- `admin@...` → admin
- `student@...` → student
- `parent@...` → parent
- `coach@...` → academic_coach
- `performance@...` → performance_coach
