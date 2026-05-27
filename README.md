# ConcursoMundial — FIFA World Cup 2026 Prediction Game

A mobile-first full-stack web app for running a private prediction game among friends.

## Tech Stack

- **Backend**: Node.js + Express.js + MongoDB (Mongoose)
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Auth**: JWT + Passport.js (local nickname/password + Google OAuth)

## Setup

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Configure environment

Edit `backend/.env` with your values:

```
MONGODB_URI=mongodb://localhost:27017/concursomundial
JWT_SECRET=change_me_to_a_long_random_string
JWT_EXPIRES_IN=7d  # Token expiration (7 days default)
FRONTEND_URL=http://localhost:5173

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Email (optional — prints to console if not set)
EMAIL_HOST=smtp.example.com
EMAIL_USER=user@example.com
EMAIL_PASS=yourpassword

# First admin user
ADMIN_NAME=Admin
ADMIN_NICKNAME=admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=changeme123
```

### 3. Seed the database

```bash
npm run seed:admin      # Creates the admin user
npm run seed:worldcup   # Seeds 48 teams
```

### 4. Start development servers

```bash
npm run dev
```

Opens:
- Backend API: http://localhost:5000
- Frontend: http://localhost:5173

## Scoring System

| Prediction | Points |
|---|---|
| Correct match outcome (W/D/L) | +2 |
| Exact final result (both scores) | +3 (1+2) |
| One score correct | +1 |
| Tournament champion | +50 |
| Tournament runner-up | +30 |
| Top scorer / top assister | +30 / +20 |
| Most yellow / red cards | +20 / +20 |

## Admin Panel

After seeding, log in with your admin credentials and visit `/admin` to:

- Manage teams, rosters (players), and matches
- Enter match results (auto-triggers scoring)
- Set final tournament results
- Lock/unlock tournament predictions
- Recalculate points manually

## Project Structure

```
/
├── backend/
│   ├── src/
│   │   ├── config/        # DB, Passport config
│   │   ├── middleware/    # auth, admin guards
│   │   ├── models/        # Mongoose models
│   │   ├── routes/        # Express routers
│   │   ├── seeds/         # Admin + World Cup seeder
│   │   └── services/      # Scoring, email
│   └── .env               # Your secrets (never commit!)
└── frontend/
    └── src/
        ├── components/    # Reusable UI
        ├── contexts/      # Auth context
        ├── pages/         # Route pages + admin/
        ├── services/      # Axios API client
        └── utils/         # Date helpers
```
