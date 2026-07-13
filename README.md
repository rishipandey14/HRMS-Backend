# WorkSphere Backend

This service powers the core API for WorkSphere: authentication, RBAC, users, companies, projects, tasks, updates, dashboards, jobs, chat, notifications, integrations, holidays, and supporting subscription/session logic.

## What it does

- Serves the REST API used by the WorkSphere frontend.
- Enforces authentication and role-based access control.
- Stores application data in MySQL through Sequelize.
- Uses Redis for presence and live session-related workflows.
- Broadcasts real-time features through Socket.IO.

## Main API areas

- `authRoutes` for login and authentication.
- `userRoutes` and `companyRoutes` for user and organization management.
- `projectRoutes`, `taskRoutes`, and `updateRoutes` for project delivery.
- `chatRoutes` and `messageRoutes` for team communication.
- `dashboardRoutes` for analytics and counters.
- `rbacRoutes` and middleware for permissions.
- `jobsRoutes`, `candidatesRoutes`, and `publicRoutes` for hiring-related flows.

## How to run locally

### Prerequisites

- Node.js 18+ recommended
- MySQL 8
- Redis 7

### Install and start

```bash
cd task-tracker-backend
npm install
npm run dev
```

The backend listens on port `7000` by default.

### Environment

Configure `task-tracker-backend/.env` with your database, Redis, and integration settings. The Docker compose file in the workspace root also passes these runtime values:

- `NODE_ENV=development`
- `SEQUELIZE_SYNC_MODE=alter`
- `PUBLIC_BACKEND_BASE_URL=http://localhost:7000`
- `RESUME_RANKER_UPLOAD_URL=http://resume-ranker:5000/upload`
- `RESUME_RANKER_SCORE_URL=http://resume-ranker:5000/score`

## Run with Docker

You can run the backend by itself with Docker or as part of the full stack.

### Full stack from the workspace root

```bash
docker-compose up --build
```

### Backend container only

```bash
cd task-tracker-backend
docker build -t worksphere-backend .
docker run -p 7000:7000 --env-file .env worksphere-backend
```

If you use the container directly, make sure MySQL and Redis are reachable from the container network.

## Resume-ranker integration

The backend is configured to call the resume-ranker service for recruitment workflows.

- Upload endpoint: `RESUME_RANKER_UPLOAD_URL`
- Scoring endpoint: `RESUME_RANKER_SCORE_URL`

This keeps resume parsing and ranking outside the main API while still surfacing hiring data inside WorkSphere.

## Contributing

1. Create a feature branch.
2. Make focused changes inside the relevant controller, route, service, or middleware.
3. Keep APIs backward compatible when possible.
4. Run relevant tests before opening a pull request.
5. Document new environment variables or routes when adding features.

### Useful scripts

```bash
npm run dev
npm test
```

## Related docs

- `API_OVERVIEW.md` for API details.
- `task/README.md` for the frontend documentation.
- `resume-ranker/README.md` for the resume service documentation.
