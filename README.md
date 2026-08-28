# Exam Preparation System Backend Repository

This repository contains the backend API and the frontend client used for exam preparation workflows.

## Repository Structure
- `exam-preparation-backend`: Node.js + Express + Prisma backend API
- `exam-preparation-frontend`: React frontend
- `docker-compose.yml`: Root-level compose orchestration

## Tech Stack
- Backend: TypeScript, Express, Prisma, PostgreSQL, JWT
- Frontend: React, React Router, Tailwind (partial usage), CRA tooling
- AI: Gemini API integration

## Prerequisites
- Node.js 18+
- npm 9+
- PostgreSQL 14+
- Docker (optional, for containerized run)

## Environment Configuration
Create backend env file:

```bash
cd exam-preparation-backend
cp .env.example .env
```

Required backend variables (from `.env.example`):
- `DATABASE_URL`
- `JWT_SECRET`
- `PORT`
- `UPLOAD_DIR`
- `UPLOAD_MAX_BYTES`
- `CORS_ORIGIN`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX`
- `GEMINI_API_KEY`

## Local Development
### 1. Backend
```bash
cd exam-preparation-backend
npm install
npm run prisma:generate
npx prisma migrate dev
npm run dev
```

Backend runs on `http://localhost:4000` (default).

### 2. Frontend
```bash
cd exam-preparation-frontend
npm install
npm start
```

Frontend runs on `http://localhost:3000` (default).

## Docker Run
### Root compose
```bash
docker compose up --build
```

### Backend-only compose
```bash
cd exam-preparation-backend
docker compose up --build
```

## API Base Paths
- `/api/auth`
- `/api/courses`
- `/api/notes`
- `/api/files`
- `/api/ai`
- `/api/timetable`
- `/api` (exam routes)
- `/health` (service health check)

## Production Build
### Backend
```bash
cd exam-preparation-backend
npm run build
npm start
```

### Frontend
```bash
cd exam-preparation-frontend
npm run build
```

## Security Notes
- Do not commit real `.env` files or service account credentials.
- Keep JWT and AI keys rotated for production.
- Uploaded runtime files should stay outside version control.
