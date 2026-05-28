# ConcursoMundial — FIFA World Cup 2026 Prediction Game

A mobile-first, full-stack web application for running a private prediction tournament among friends during the 2026 FIFA World Cup. Users predict match scores, tournament outcomes, and compete on leaderboards inside private groups.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Architecture Overview](#architecture-overview)
4. [Project Structure](#project-structure)
5. [Getting Started (Local)](#getting-started-local)
6. [Environment Variables](#environment-variables)
7. [Database Models](#database-models)
8. [API Reference](#api-reference)
9. [Scoring System](#scoring-system)
10. [Seed Scripts](#seed-scripts)
11. [Scheduled Jobs](#scheduled-jobs)
12. [Admin Panel](#admin-panel)
13. [Push Notifications](#push-notifications)
14. [Image Storage (MinIO)](#image-storage-minio)
15. [Deployment (Coolify / Docker)](#deployment-coolify--docker)
16. [Frontend Pages](#frontend-pages)

---

## Features

### Predictions
- **Match predictions** — predict the exact home/away score before each match locks.
- **Tournament predictions** — predict champion, runner-up, top scorer, top assister, player with most yellow cards, and player with most red cards.
- Predictions lock automatically when the first match of the tournament finishes (tournament) or at kick-off (match).
- Full knockout-stage support — predictions unlock as the bracket progresses.

### Groups
- Create or join **private groups** via a unique invite link.
- Groups can be configured as **open** (anyone with the link joins instantly) or **invite-only** (creator approves/rejects join requests).
- Each group has its own leaderboard computed independently.
- Groups support an optional description and WhatsApp link.
- Share invites via the native share sheet, or generate a **QR code** that can be scanned to join. The QR modal also provides a copy-link button and a one-tap PNG download.

### Leaderboard
- **Global leaderboard** across all registered users.
- **Per-group leaderboard** visible only to group members.
- Rankings include match points, tournament points, and total.
- Client-side pagination (default 50 per page; options 10 / 20 / 50 / 100) with prev/next controls and numbered page buttons.

### User Accounts
- Register with email/password or sign in with **Google OAuth**.
- Email verification required before making predictions.
- **Password reset** via email link.
- Customisable profile: avatar (uploaded to MinIO), favourite team, nickname.
- View any other user's public profile with their prediction history.
- Privacy setting to control whether you can receive group invites.

### Notifications
- **Email reminders** before matches at configurable intervals: 24 h, 6 h, 4 h, or 1 h.
- **Push notifications** (Web Push / VAPID) for users who install the PWA.
- Daily push digests at 11:00 UTC and 17:30 UTC listing upcoming unpredicted matches.
- Per-channel configuration: choose email, push, or both independently.

### Progressive Web App (PWA)
- Installable on Android and iPhone from the browser.
- Service worker handles push subscription and background sync.
- Offline-capable shell with skeleton loaders.

### Admin Panel
- Manage teams, player rosters, and match schedule via CSV upload or inline forms.
- Enter match results — scoring triggers automatically on save.
- Configure tournament results (champion, top scorer, etc.) and recalculate points.
- Lock/unlock the prediction window.
- Monitor and manually trigger scheduled cron jobs.
- View cron execution logs.

### Live Data
- **Live score updates** every minute via the [football-data.org](https://www.football-data.org) API.
- Player roster synchronisation every hour from the same API.
- Automatic prediction scoring as soon as a match status becomes `finished`.
- Retry logic with exponential backoff for transient network errors.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend runtime | Node.js 20 |
| Backend framework | Express.js 4 |
| Database | MongoDB 7 (Mongoose 8) |
| Auth | JWT + Passport.js (local + Google OAuth 2.0) |
| Frontend framework | React 18 + Vite 5 |
| Styling | Tailwind CSS 3 |
| Image storage | MinIO (S3-compatible) |
| Cache | Redis (optional, caches presigned MinIO URLs) |
| Email | Nodemailer (SMTP) |
| Push notifications | Web Push / VAPID (`web-push`) |
| Live scores | football-data.org API v4 |
| Onboarding tour | Driver.js |
| HTTP client | Axios |
| Cron | node-cron |
| Containerisation | Docker + Docker Compose |
| Reverse proxy | nginx (frontend container) |
| Deployment | Coolify + Traefik |

---

## Architecture Overview

```
Browser / PWA
     │
     ▼
┌─────────────┐      static assets
│  nginx      │ ◄──── React build (Vite)
│  (port 80)  │
└──────┬──────┘
       │  /api/*  proxy
       ▼
┌─────────────┐      ┌──────────────┐
│  Express    │ ───► │  MongoDB     │
│  (port 5000)│      └──────────────┘
│             │      ┌──────────────┐
│             │ ───► │  Redis       │  (optional URL cache)
│             │      └──────────────┘
│             │      ┌──────────────┐
│             │ ───► │  MinIO       │  (avatar/image storage)
└─────────────┘      └──────────────┘
       │
       ▼
┌───────────────────┐
│  football-data.org│  (live scores, rosters)
└───────────────────┘
```

All requests from the browser go through nginx. Static assets are served directly; `/api/*` requests are proxied to the Express backend.

---

## Project Structure

```
/
├── package.json                  # Root: dev convenience scripts + concurrently
├── docker-compose.yml            # Production Docker Compose (backend + frontend)
├── DEPLOYMENT.md                 # Coolify/Traefik deployment guide
│
├── backend/
│   ├── package.json
│   ├── Dockerfile
│   └── src/
│       ├── app.js                # Express app bootstrap, middleware, route registration
│       ├── config/
│       │   ├── db.js             # Mongoose connection with retry logic
│       │   ├── minio.js          # S3Client (MinIO) instance
│       │   ├── passport.js       # Passport strategies (local + Google OAuth)
│       │   └── redis.js          # Optional Redis client with graceful degradation
│       ├── middleware/
│       │   ├── auth.js           # JWT bearer token verification (protect)
│       │   └── admin.js          # isAdmin guard (requireAdmin)
│       ├── models/
│       │   ├── User.js           # User account, push subscriptions, preferences
│       │   ├── Group.js          # Prediction group, invite code, privacy settings
│       │   ├── Match.js          # WC match: teams, date, stage, matchday, scores
│       │   ├── MatchPrediction.js     # Per-user match score prediction + points
│       │   ├── TournamentPrediction.js # Per-user tournament outcome prediction
│       │   ├── Player.js         # Player: name, team, position, stats
│       │   ├── Team.js           # Team: name, FIFA code, badge, flag
│       │   ├── MatchReminder.js  # Deduplication log for sent email reminders
│       │   ├── Settings.js       # Generic key-value store for system settings
│       │   └── Changelog.js      # In-app version changelog entries
│       ├── routes/
│       │   ├── auth.js           # /api/auth — register, login, Google OAuth, verify email, password reset
│       │   ├── groups.js         # /api/groups — CRUD groups, join, invites, requests
│       │   ├── matches.js        # /api/matches — list matches, filter by stage/matchday
│       │   ├── predictions.js    # /api/predictions — match & tournament predictions
│       │   ├── leaderboard.js    # /api/leaderboard — global & per-group rankings
│       │   ├── players.js        # /api/players — list players by team
│       │   ├── teams.js          # /api/teams — list all teams
│       │   ├── profile.js        # /api/profile — edit profile, push subscription mgmt
│       │   ├── users.js          # /api/users/:id — public user profile
│       │   ├── images.js         # /api/images — presigned MinIO URL proxy
│       │   ├── admin.js          # /api/admin — admin-only: teams, rosters, matches, results, scoring, settings, cron
│       │   └── changelog.js      # /api/changelog — list changelog entries
│       ├── seeds/
│       │   ├── admin.js                      # Create/promote admin user
│       │   ├── worldcup.js                   # Seed 48 WC 2026 teams (static data)
│       │   ├── importFootballData.js         # Import group-stage matches from football-data.org
│       │   ├── importFootballDataKnockout.js # Import knockout matches from football-data.org
│       │   ├── importSportsDB.js             # Import match thumbnails from TheSportsDB
│       │   ├── assignKnockoutMatchNumbers.js # Assign sequential numbers to knockout matches
│       │   ├── assignMatchdays.js            # Assign matchday (1/2/3) to group-stage matches
│       │   ├── cleanup.js                    # Remove orphan predictions and stale data
│       │   └── changelog.js                  # Seed in-app changelog entries
│       └── services/
│           ├── scoring.js          # Match & tournament points calculation
│           ├── scheduler.js        # node-cron jobs: live scores, roster sync, reminders
│           ├── email.js            # Nodemailer: verification, reminders, password reset
│           ├── pushNotifications.js # Web Push: send push to user subscriptions
│           ├── footballdata.js     # football-data.org API client with retry logic
│           ├── sportsdb.js         # TheSportsDB API client
│           ├── imageUploader.js    # Sharp image processing + MinIO upload
│           └── cronLogger.js       # In-memory + MinIO cron execution log
│
└── frontend/
    ├── package.json
    ├── Dockerfile
    ├── vite.config.js
    ├── tailwind.config.js
    ├── nginx.conf                # nginx reverse-proxy config (serves built app)
    ├── index.html
    ├── public/
    │   └── sw.js                 # Service worker (push notifications + install)
    └── src/
        ├── main.jsx              # App entry, service worker registration
        ├── App.jsx               # Router, layout, protected routes
        ├── index.css             # Tailwind base + custom global styles
        ├── components/
        │   ├── BottomNav.jsx     # Mobile bottom navigation bar
        │   ├── LoadingSpinner.jsx
        │   ├── MatchCard.jsx     # Match result/prediction card
        │   ├── MinioImage.jsx    # Image component with presigned URL fetching
        │   ├── PageHeader.jsx    # Page title header
        │   ├── PageTransition.jsx # Animated route transitions
        │   ├── ProtectedRoute.jsx # Redirects unauthenticated users
        │   ├── SearchableSelect.jsx # Dropdown with search (teams/players)
        │   ├── Skeletons.jsx     # Skeleton loading placeholders
        │   └── Toast.jsx         # Toast notification component
        ├── contexts/
        │   ├── AuthContext.jsx   # Auth state, login/logout, token refresh
        │   └── ThemeContext.jsx  # Light/dark theme with localStorage persistence
        ├── pages/
        │   ├── Login.jsx                # Login form + Google OAuth button
        │   ├── Register.jsx             # Registration form
        │   ├── AuthCallback.jsx         # Google OAuth callback handler
        │   ├── VerifyEmail.jsx          # Email verification confirmation
        │   ├── ForgotPassword.jsx       # Request password reset email
        │   ├── ResetPassword.jsx        # Set new password via token link
        │   ├── Home.jsx                 # Dashboard: upcoming matches, countdown
        │   ├── Matches.jsx              # All matches with stage/matchday filter
        │   ├── MatchPredictions.jsx     # Match list with prediction status
        │   ├── PredictionForm.jsx       # Score input form for a single match
        │   ├── TournamentPredictions.jsx # Champion, top scorer, etc.
        │   ├── Groups.jsx               # Group list, create, join, QR share, requests
        │   ├── GroupDashboard.jsx       # Group detail: members, leaderboard, settings
        │   ├── JoinGroup.jsx            # Landing page for invite links
        │   ├── Leaderboard.jsx          # Global / group leaderboard with pagination
        │   ├── Profile.jsx              # Own profile: avatar, preferences, push toggle
        │   ├── UserProfile.jsx          # Another user's public profile
        │   └── admin/
        │       ├── AdminDashboard.jsx   # Admin home
        │       ├── AdminTeams.jsx       # Manage teams
        │       ├── AdminRosters.jsx     # Manage player rosters (CSV upload)
        │       ├── AdminMatches.jsx     # Manage match schedule (CSV upload)
        │       ├── AdminResults.jsx     # Enter/edit match results
        │       ├── AdminScoring.jsx     # Trigger/recalculate scoring
        │       ├── AdminSettings.jsx    # Tournament settings, lock predictions
        │       └── AdminCron.jsx        # Cron job monitor and manual trigger
        ├── services/
        │   └── api.js            # Axios instance with JWT interceptor + token refresh
        └── utils/
            ├── date.js           # Date formatting helpers
            ├── jwt.js            # JWT decode + expiry check (client-side)
            ├── push.js           # Web Push subscription helpers
            ├── tour.js           # Driver.js onboarding tour definition
            └── userAgent.js      # Embedded browser detection (Instagram, TikTok, etc.)
```

---

## Getting Started (Local)

### Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)
- (Optional) Redis, MinIO

### 1. Install all dependencies

```bash
npm run install:all
```

### 2. Configure the backend environment

```bash
cp backend/.env.example backend/.env
# then edit backend/.env with your values
```

See [Environment Variables](#environment-variables) for the full reference.

### 3. Seed the database

```bash
# From the repo root
npm run seed:admin      # Creates admin user (reads ADMIN_* vars from .env)
npm run seed:worldcup   # Seeds all 48 WC 2026 teams

# From backend/ directly (full seed suite)
cd backend
npm run seed:footballdata          # Import group-stage matches from football-data.org
npm run seed:footballdata:knockout # Import knockout-stage matches
npm run seed:matchdays             # Assign matchday numbers (1/2/3) to group matches
npm run seed:knockout:numbers      # Assign sequential numbers to knockout matches
npm run seed:sportsdb              # Add match thumbnail images from TheSportsDB
npm run seed:changelog             # Seed in-app changelog entries
npm run seed:cleanup               # Remove orphan / stale data
```

### 4. Start development servers

From the project root:

```bash
npm run dev
```

This runs backend and frontend concurrently:
- Backend API: `http://localhost:5000`
- Frontend (Vite HMR): `http://localhost:5173`

---

## Environment Variables

All variables go in `backend/.env`. The frontend only needs `VITE_MINIO_ENDPOINT` at **build time** (injected via Docker build arg in production).

### Required

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DB` | Database name (default: `worldcup2026`) |
| `JWT_SECRET` | Long random string for signing JWTs |
| `JWT_EXPIRES_IN` | Token lifetime (default: `7d`) |
| `FRONTEND_URL` | Browser-facing origin, used for CORS (e.g. `https://yourdomain.com`) |
| `BACKEND_URL` | Server-facing origin, used for Google OAuth callback |
| `EMAIL_USER` | SMTP login |
| `EMAIL_PASS` | SMTP password / app password |
| `EMAIL_FROM` | Sender display name + address |

### Optional

| Variable | Default | Description |
|---|---|---|
| `EMAIL_HOST` | `smtp.gmail.com` | SMTP host |
| `EMAIL_PORT` | `587` | SMTP port |
| `EMAIL_SECURE` | `false` | Use TLS (`true` for port 465) |
| `GOOGLE_CLIENT_ID` | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth client secret |
| `MINIO_ENDPOINT` | — | MinIO / S3-compatible endpoint URL |
| `MINIO_ACCESS_KEY` | — | MinIO access key |
| `MINIO_SECRET_KEY` | — | MinIO secret key |
| `MINIO_BUCKET` | `worldcup2026` | Bucket name for avatars and images |
| `MINIO_REGION` | `us-east-1` | S3 region |
| `MINIO_PUBLIC_URL` | — | Public base URL for served images |
| `REDIS_URL` | — | Redis connection URL (disables URL cache if absent) |
| `FOOTBALL_DATA_API_KEY` | — | football-data.org API key (disables live scores if absent) |
| `VAPID_PUBLIC_KEY` | — | VAPID public key for Web Push |
| `VAPID_PRIVATE_KEY` | — | VAPID private key for Web Push |
| `VAPID_SUBJECT` | — | VAPID contact email (`mailto:...`) |
| `TRUST_PROXY_HOPS` | `2` | Express `trust proxy` value (1 if no outer proxy) |
| `PORT` | `5000` | Backend listen port |

### Admin seed variables (`.env` only)

| Variable | Description |
|---|---|
| `ADMIN_NAME` | Full name for the admin account |
| `ADMIN_NICKNAME` | Unique nickname (used to log in) |
| `ADMIN_EMAIL` | Admin email address |
| `ADMIN_PASSWORD` | Admin password |

---

## Database Models

### User
Stores credentials, preferences, push subscriptions, and privacy settings.

| Field | Type | Notes |
|---|---|---|
| `name` | String | Display name |
| `nickname` | String | Unique login handle (3–20 chars, lowercase) |
| `email` | String | Unique, used for email auth and notifications |
| `password` | String | bcrypt-hashed; absent for Google-only accounts |
| `googleId` | String | Google OAuth subject ID |
| `avatar` | String | MinIO object key for profile picture |
| `favoriteTeam` | ObjectId → Team | |
| `isEmailVerified` | Boolean | Required before predictions |
| `isAdmin` | Boolean | Grants access to `/admin` routes |
| `notificationPreferences` | [String] | Email reminder windows: `24h`, `6h`, `4h`, `1h` (max 2) |
| `pushNotificationsEnabled` | Boolean | Master push toggle |
| `pushReminderPreferences` | [String] | Push reminder windows |
| `pushSubscriptions` | [Mixed] | Array of Web Push subscription objects |
| `acceptGroupInvites` | Boolean | Privacy: allow others to send group invites |

### Group

| Field | Type | Notes |
|---|---|---|
| `name` | String | Max 50 chars |
| `description` | String | Optional, max 300 chars |
| `whatsappLink` | String | Optional WhatsApp group link |
| `isPublic` | Boolean | `true` = open join; `false` = invite/request only |
| `acceptJoinRequests` | Boolean | Allow users to request to join |
| `creator` | ObjectId → User | Always a member |
| `members` | [ObjectId → User] | Includes creator |
| `inviteCode` | String | UUID-based, unique |
| `pendingRequests` | [{user, type, createdAt}] | `type`: `request` or `invite` |

### Match

| Field | Type | Notes |
|---|---|---|
| `matchNumber` | Number | Sequential identifier |
| `homeTeam` / `awayTeam` | ObjectId → Team | |
| `matchDate` | Date | Kick-off time (UTC) |
| `stage` | String | `group_stage`, `round_of_32`, `round_of_16`, `quarter_final`, `semi_final`, `third_place`, `final` |
| `group` | String | Group letter (`A`–`L`), group stage only |
| `matchday` | Number | `1`, `2`, or `3` within group stage |
| `venue` | String | Stadium name |
| `homeScore` / `awayScore` | Number | `null` while scheduled |
| `status` | String | `scheduled`, `in_progress`, `finished` |
| `footballDataId` | String | ID in football-data.org |

### MatchPrediction

| Field | Type | Notes |
|---|---|---|
| `user` | ObjectId → User | |
| `match` | ObjectId → Match | |
| `group` | ObjectId → Group | `null` = global prediction |
| `homeScore` / `awayScore` | Number | Predicted scores |
| `points` | Number | `null` until match finishes |

Unique index: `(user, match, group)`.

### TournamentPrediction

| Field | Type | Notes |
|---|---|---|
| `user` | ObjectId → User | |
| `group` | ObjectId → Group | `null` = global |
| `champion` | ObjectId → Team | |
| `runnerUp` | ObjectId → Team | |
| `topScorer` | ObjectId → Player | |
| `topAssister` | ObjectId → Player | |
| `mostYellowCards` | ObjectId → Player | |
| `mostRedCards` | ObjectId → Player | |
| `points` | Number | `null` until tournament ends |

Unique index: `(user, group)`.

### Settings
Generic key-value store. Used to lock the prediction window and store tournament results.

### Changelog
In-app version history. Each document has `version`, `date`, `title`, and `items` (bullet points).

---

## API Reference

All routes are prefixed with `/api`. Protected routes require `Authorization: Bearer <token>`.

### Auth — `/api/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/register` | — | Register with name, nickname, email, password |
| POST | `/login` | — | Login; returns JWT |
| GET | `/google` | — | Redirect to Google OAuth |
| GET | `/google/callback` | — | OAuth callback; redirects to frontend with token |
| GET | `/verify-email/:token` | — | Verify email address |
| POST | `/resend-verification` | — | Resend verification email |
| POST | `/forgot-password` | — | Send password reset email |
| POST | `/reset-password/:token` | — | Set new password |
| GET | `/me` | ✓ | Get current user |
| PATCH | `/profile` | ✓ | Update nickname, name, favoriteTeam |

### Groups — `/api/groups`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | ✓ | List my groups |
| POST | `/` | ✓ | Create a group |
| GET | `/:id` | ✓ | Get group details (must be a member) |
| PATCH | `/:id` | ✓ | Update group name/description/settings (creator only) |
| DELETE | `/:id` | ✓ | Delete group (creator only) |
| POST | `/join/:inviteCode` | ✓ | Join a group by invite code (or send request if private) |
| POST | `/:id/leave` | ✓ | Leave a group |
| GET | `/:id/requests` | ✓ | List pending join requests (creator only) |
| POST | `/:id/requests/:userId/approve` | ✓ | Approve a join request |
| POST | `/:id/requests/:userId/reject` | ✓ | Reject a join request |
| POST | `/:id/invite/:userId` | ✓ | Invite a user directly (creator only) |

### Matches — `/api/matches`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | ✓ | List matches (filter: `stage`, `matchday`, `date`) |

### Predictions — `/api/predictions`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/match` | ✓ | Get my match predictions (filter by `groupId`) |
| POST | `/match` | ✓ | Submit / update a match prediction |
| GET | `/tournament` | ✓ | Get my tournament prediction |
| POST | `/tournament` | ✓ | Submit / update tournament prediction |

### Leaderboard — `/api/leaderboard`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/global` | ✓ | Global leaderboard (all users) |
| GET | `/:groupId` | ✓ | Group leaderboard (members only) |

### Profile — `/api/profile`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/avatar` | ✓ | Upload profile picture (multipart/form-data) |
| DELETE | `/avatar` | ✓ | Remove profile picture |
| PATCH | `/notifications` | ✓ | Update email/push notification preferences |
| POST | `/push-subscription` | ✓ | Register a push subscription |
| DELETE | `/push-subscription` | ✓ | Remove a push subscription |

### Users — `/api/users`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/:id` | ✓ | Get public profile of any user |
| GET | `/:id/predictions` | ✓ | Get a user's match prediction history |

### Teams — `/api/teams`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | ✓ | List all 48 teams |

### Players — `/api/players`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | ✓ | List players (filter: `teamId`) |

### Changelog — `/api/changelog`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | ✓ | List all changelog entries (newest first) |

### Images — `/api/images`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/:key` | ✓ | Returns a presigned MinIO URL for the given object key (cached in Redis) |

### Admin — `/api/admin` _(admin only)_

| Method | Path | Description |
|---|---|---|
| GET/POST/PATCH/DELETE | `/teams` | Manage teams |
| GET/POST/PATCH/DELETE | `/players` | Manage players; POST with CSV for bulk upload |
| GET/POST/PATCH/DELETE | `/matches` | Manage matches; POST with CSV for bulk upload |
| POST | `/results` | Save match result (triggers automatic scoring) |
| POST | `/scoring/match/:id` | Recalculate points for a specific match |
| POST | `/scoring/tournament` | Recalculate all tournament prediction points |
| GET/POST | `/settings` | Read/write settings (e.g. `predictionsLocked`) |
| GET | `/cron` | List registered cron jobs and recent execution logs |
| POST | `/cron/:name/run` | Manually trigger a cron job |

---

## Scoring System

### Match Predictions

Points are awarded per prediction once a match status becomes `finished`:

| Condition | Points |
|---|---|
| Correct outcome (home win / draw / away win) | +2 |
| Correct exact final score (both goals right) | +3 (1 + 2) |
| One team's score correct | +1 |

Maximum per match: **5 points** (correct outcome + exact score).

### Tournament Predictions

Awarded once admin enters the final tournament results:

| Category | Points |
|---|---|
| Champion | +50 |
| Runner-up | +30 |
| Top scorer | +30 |
| Top assister | +20 |
| Most yellow cards | +20 |
| Most red cards | +20 |

Maximum tournament bonus: **170 points**.

---

## Seed Scripts

All scripts are run from the `backend/` directory (or via root convenience shortcuts). They are idempotent — safe to re-run.

| Script | Command | Description |
|---|---|---|
| Admin user | `npm run seed:admin` | Creates or promotes the admin user from `.env` vars |
| Teams | `npm run seed:worldcup` | Seeds all 48 WC 2026 teams with FIFA codes, names, and flags |
| Group-stage matches | `npm run seed:footballdata` | Imports group-stage matches from football-data.org (requires API key) |
| Knockout matches | `npm run seed:footballdata:knockout` | Imports knockout bracket from football-data.org |
| Match thumbnails | `npm run seed:sportsdb` | Fetches match thumbnail images from TheSportsDB (free key) |
| Matchdays | `npm run seed:matchdays` | Assigns matchday numbers (1/2/3) to group-stage matches |
| Knockout numbers | `npm run seed:knockout:numbers` | Assigns sequential display numbers to knockout matches |
| Changelog | `npm run seed:changelog` | Upserts in-app changelog entries |
| Cleanup | `npm run seed:cleanup` | Removes orphan predictions and stale records |

---

## Scheduled Jobs

The scheduler starts automatically on server boot after MongoDB connects. All jobs are also visible and triggerable from the Admin → Cron panel.

| Job | Schedule | Description |
|---|---|---|
| `recordatorios` | Every 5 min | Sends email reminders 24 h / 6 h / 4 h / 1 h before matches |
| `push-partidos` | Every 5 min | Sends push reminders before unpredicted matches |
| `marcadores` | Every 1 min | Polls football-data.org for live scores; triggers scoring on `finished` |
| `plantillas` | Every 1 h | Syncs all 48 squad rosters from football-data.org |
| `limpieza-logs` | 02:30 UTC daily | Deletes MinIO cron logs older than 7 days |
| `push-manana` | 11:00 UTC daily | Daily push digest for users with unpredicted upcoming matches |
| `push-tarde` | 17:30 UTC daily | Second daily push digest |

Live score and roster sync jobs are skipped silently if `FOOTBALL_DATA_API_KEY` is not set. Failed API calls are retried up to 3 times with 2 s / 4 s exponential backoff.

---

## Admin Panel

Log in with an admin account and navigate to `/admin`.

- **Teams** (`/admin/teams`) — Edit team names, FIFA codes, badge images.
- **Rosters** (`/admin/rosters`) — Upload player squads via CSV or edit inline.
- **Matches** (`/admin/matches`) — Upload match schedule via CSV or edit individual matches.
- **Results** (`/admin/results`) — Enter final scores. Saving a result immediately recalculates match prediction points for all users.
- **Scoring** (`/admin/scoring`) — Manually trigger recalculation for a specific match or all tournament predictions.
- **Settings** (`/admin/settings`) — Lock/unlock the global prediction window; set tournament results (champion, top scorer, etc.).
- **Cron** (`/admin/cron`) — View scheduled jobs, last run time, last result, and trigger any job manually.

---

## Push Notifications

Web Push uses the VAPID protocol. Generate a key pair once:

```bash
npx web-push generate-vapid-keys
```

Add the output to `backend/.env`:

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
```

The frontend service worker (`public/sw.js`) handles incoming push events and displays system notifications. Users subscribe from their Profile page — the subscription object is stored in `User.pushSubscriptions`.

---

## Image Storage (MinIO)

Profile avatars and team/match images are stored in a MinIO (S3-compatible) bucket.

- Images are processed with **Sharp** before upload (resized, converted to WebP).
- The frontend never requests MinIO directly. Instead it calls `/api/images/:key` which returns a short-lived presigned URL.
- Presigned URLs are cached in Redis (if configured) to reduce MinIO requests.

If `MINIO_ENDPOINT` is not set, avatar upload is disabled; default avatars are used.

---

## Deployment (Coolify / Docker)

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full guide. Quick summary:

1. Push the repository to a Git provider.
2. In Coolify, create a new **Docker Compose** service pointing to the repo.
3. Set all required environment variables in the Coolify dashboard.
4. Deploy — Coolify builds both images and routes traffic via Traefik.

The `docker-compose.yml` exposes only port 80 on the frontend container. The backend is internal-only (`expose: 5000`). nginx in the frontend container proxies `/api/*` to the backend.

### First-run after deploy

SSH into the running backend container and run the seeds:

```bash
npm run seed:admin
npm run seed:worldcup
npm run seed:footballdata
npm run seed:matchdays
npm run seed:changelog
```

### Health checks

- Backend: `GET /api/health` → `200 OK`
- Frontend: `curl http://localhost/` → HTML

---

## Frontend Pages

| Route | Page | Notes |
|---|---|---|
| `/login` | Login | Email/password + Google OAuth button |
| `/register` | Register | Creates account + sends verification email |
| `/auth/callback` | AuthCallback | Receives token from Google OAuth redirect |
| `/verify-email/:token` | VerifyEmail | Confirms email address |
| `/forgot-password` | ForgotPassword | Sends reset link |
| `/reset-password/:token` | ResetPassword | Sets new password |
| `/` | Home | Upcoming matches with countdown, prediction status |
| `/matches` | Matches | All matches filterable by stage and matchday |
| `/predictions` | MatchPredictions | My predictions list |
| `/predictions/:matchId` | PredictionForm | Score input for a single match |
| `/tournament` | TournamentPredictions | Champion, top scorer, etc. |
| `/groups` | Groups | My groups, create group, QR share, discover public groups |
| `/groups/:id` | GroupDashboard | Members, leaderboard, group settings |
| `/join/:code` | JoinGroup | Landing page for invite links |
| `/leaderboard` | Leaderboard | Global and per-group rankings with pagination |
| `/profile` | Profile | Edit profile, notification preferences, push toggle |
| `/users/:id` | UserProfile | Another user's public profile |
| `/admin` | AdminDashboard | Admin home _(admin only)_ |
| `/admin/teams` | AdminTeams | _(admin only)_ |
| `/admin/rosters` | AdminRosters | _(admin only)_ |
| `/admin/matches` | AdminMatches | _(admin only)_ |
| `/admin/results` | AdminResults | _(admin only)_ |
| `/admin/scoring` | AdminScoring | _(admin only)_ |
| `/admin/settings` | AdminSettings | _(admin only)_ |
| `/admin/cron` | AdminCron | _(admin only)_ |
