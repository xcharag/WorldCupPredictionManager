 # CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ConcursoMundial** is a full-stack FIFA World Cup 2026 prediction tournament app (mobile-first PWA). Users join private groups, predict match scores, and compete on leaderboards. Live scores are polled from football-data.org every minute and trigger automatic scoring.

## Commands

### Development

```bash
# Install all deps (root + backend + frontend)
npm run install:all

# Start both backend (port 5000) and frontend (port 5173) concurrently
npm run dev

# Backend only (Express + nodemon)
npm run dev:backend

# Frontend only (Vite + HMR)
npm run dev:frontend
```

### Build & Preview

```bash
# Production build (run from project root or frontend/)
cd frontend && npm run build
npm run preview   # preview production build locally
```

### Database Seeds

```bash
npm run seed:admin      # create/promote admin user
npm run seed:worldcup   # seed 48 WC2026 teams and groups
```

No test or lint scripts are configured.

## Architecture

```
Browser/PWA
    ↓
nginx :80 (frontend container, serves Vite build)
    ↓  /api/*
Express :5000 (backend container)
    ├── MongoDB  — users, groups, matches, predictions, teams, players
    ├── Redis    — MinIO presigned URL cache (optional)
    ├── MinIO    — S3-compatible avatar/image storage (optional)
    └── football-data.org API — live scores & rosters
```

### Backend (`backend/src/`)

| Path | Role |
|---|---|
| `app.js` | Express bootstrap: middleware, route registration, Passport, cron jobs |
| `config/` | DB connection (Mongoose), MinIO, Passport strategies, Redis |
| `middleware/` | JWT auth guard, admin guard |
| `models/` | Mongoose schemas — User, Group, Match, Predictions, Team, Player, etc. |
| `routes/` | REST endpoints — `/auth`, `/groups`, `/matches`, `/predictions`, `/leaderboard`, `/admin`, etc. |
| `services/` | Business logic — scoring engine, scheduler (node-cron), email (Nodemailer), Web Push, API clients (football-data/SportsDB), image upload (Sharp) |
| `seeds/` | One-shot data initialization scripts |

**Scheduled jobs** (registered in `app.js`, run via node-cron):

| Job | Schedule | Purpose |
|---|---|---|
| `marcadores` | Every 30 s | Poll live scores; trigger scoring on finished matches; goal push notifications |
| `recordatorios` | Every 5 min | Email reminders for upcoming matches |
| `push-partidos` | Every 5 min | Push reminders for unpredicted matches |
| `plantillas` | Every 1 hour | Sync team rosters from football-data.org |
| `push-manana` | 11:00 UTC | Daily push digest |
| `push-tarde` | 17:30 UTC | Daily push digest |
| `limpieza-logs` | 02:30 UTC | Clean up old cron logs |

### Frontend (`frontend/src/`)

| Path | Role |
|---|---|
| `App.jsx` | React Router v6 setup with `<ProtectedRoute>` |
| `contexts/` | `AuthContext` (JWT + localStorage), `ThemeContext` (dark/light mode) |
| `services/api.js` | Axios instance — injects `Authorization: Bearer` header, handles token refresh |
| `pages/` | Route-level views: Login, Register, Home, Matches, Leaderboard, Groups, Profile, Admin |
| `components/` | Shared UI: BottomNav, MatchCard, LoadingSpinner, Toast, etc. |
| `utils/` | Date helpers, JWT decode, Web Push subscription, onboarding tour, browser detection |

### Auth Flow

- **Local**: email/password → JWT (access) + refresh token stored in localStorage
- **Google OAuth 2.0**: handled by Passport; callback redirects to frontend with JWT
- Axios interceptor in `api.js` automatically refreshes expired access tokens
- Email verification is required before making predictions

### Scoring System

**Per match** (max 5 pts):
- Correct outcome (W/D/L): +2 pts
- Correct exact score: +3 pts
- One team score correct: +1 pt

**Tournament predictions** (max 170 pts):
- Champion +50, Runner-up +30, Top scorer +30, Top assister +20, Most yellows +20, Most reds +20

## Environment Variables

Copy `backend/.env.example` to `backend/.env`. Required variables:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Long random string for signing JWTs |
| `FRONTEND_URL` | Browser origin (CORS) |
| `BACKEND_URL` | Server origin (OAuth callback) |
| `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` | SMTP credentials |

Optional (features disable gracefully if absent):

| Variable | Feature |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `MINIO_*` | Avatar/image storage |
| `REDIS_URL` | Presigned URL cache |
| `FOOTBALL_DATA_API_KEY` | Live scores and roster sync |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push notifications |
| `SPORTSDB_API_KEY` | Match thumbnails (free key: `123`) |

## Tech Stack

| Layer | Stack |
|---|---|
| Backend | Node.js 20, Express 4, Mongoose 8 (MongoDB 7) |
| Frontend | React 18, Vite 5, React Router 6, Tailwind CSS 3 |
| Auth | JWT + Passport.js (local + Google OAuth 2.0) |
| Scheduling | node-cron |
| Images | Sharp (resize) + MinIO (storage) |
| Email | Nodemailer (SMTP) |
| Push | web-push (VAPID) |
| Deployment | Docker Compose, nginx, Coolify + Traefik |
