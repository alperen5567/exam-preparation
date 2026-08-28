# Exam Preparation Backend

Backend API for exam preparation workflows.

## Stack
- Node.js + TypeScript
- Express
- Prisma ORM
- PostgreSQL
- JWT auth
- Gemini API integration

## Prerequisites
- Node.js 18+
- npm
- PostgreSQL 14+

## Setup
```bash
cp .env.example .env
npm install
npm run prisma:generate
npx prisma migrate dev
npm run dev
```

Default API URL: `http://localhost:4000`

## Environment Variables
- `DATABASE_URL`
- `JWT_SECRET`
- `PORT` (default `4000`)
- `UPLOAD_DIR` (default `./uploads`)
- `UPLOAD_MAX_BYTES`
- `CORS_ORIGIN`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX`
- `GEMINI_API_KEY`

## Available Scripts
```bash
npm run dev
npm run build
npm run start
npm run prisma:generate
npm run prisma:migrate
```

## Health Check
`GET /health`

## API Routes
- `POST /api/auth/register`
- `POST /api/auth/login`
- `/api/courses`
- `/api/notes`
- `/api/files`
- `/api/ai`
- `/api/timetable`
- `/api` (exam endpoints)

## Build & Run
```bash
npm run build
npm start
```
