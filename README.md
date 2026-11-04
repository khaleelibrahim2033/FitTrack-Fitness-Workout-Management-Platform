# FitTrack

A full-stack fitness and workout management app. The API is built with FastAPI, SQLAlchemy, and SQLite; the responsive React/TypeScript client is built with Vite.

## Features

- Email/password registration and login with bcrypt password hashes and expiring JWTs
- Owner-scoped workout CRUD and automatically maintained daily progress summaries
- Fitness goals with progress tracking, completion/overdue status, and goal notifications
- Daily activity dashboard, weekly report, monthly report, and calorie charts
- Per-user notifications, daily workout reminders, and read/unread controls
- Input validation, production JWT-secret guard, and configurable CORS/database settings

## Run locally

### API

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

The API is available at `http://localhost:8000`; interactive API documentation is at `http://localhost:8000/docs`. Swagger groups endpoints into Authentication, Workouts, Progress, Reports, Goals, Notifications, and System sections. In production, set `APP_ENV=production` and provide a strong, unique `JWT_SECRET_KEY`. The development secret is not suitable for deployment.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

The app is available at `http://localhost:5173`. To point it at another API origin, define `VITE_API_URL` (for example, `http://localhost:8000/api`) before starting Vite. Set `FRONTEND_ORIGIN` on the API to the frontend origin; multiple comma-separated origins are supported.

## API overview

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET|POST /api/workouts`, `PATCH|DELETE /api/workouts/{id}`
- `GET /api/progress`, `GET /api/reports/weekly`, `GET /api/reports/monthly`
- `GET|POST /api/goals`, `PATCH|DELETE /api/goals/{id}`
- `GET /api/notifications`, `PATCH /api/notifications/{id}/read`, `PATCH /api/notifications/read-all`

All workout, progress, report, goal, and notification routes require a bearer token. Records are always queried and changed within the authenticated user's ownership scope.
