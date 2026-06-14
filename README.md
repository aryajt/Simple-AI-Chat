# Niksam Chat App

A real-time AI chat application built as a monorepo with a NestJS API, NestJS AI service, Next.js frontend, PostgreSQL, and NATS messaging.

## Architecture

```
┌─────────────┐     HTTP/SSE      ┌─────────────┐     NATS      ┌─────────────┐
│  Frontend   │ ◄────────────────► │     API     │ ◄────────────► │ AI Service  │
│  (Next.js)  │                   │  (NestJS)   │               │  (NestJS)   │
└─────────────┘                   └──────┬──────┘               └─────────────┘
                                         │
                                   ┌─────▼──────┐
                                   │ PostgreSQL  │
                                   └────────────┘
```

- **Frontend** — Next.js 14 app (port 3001). Sends messages via REST, receives AI responses via SSE.
- **API** — NestJS REST API (port 3000). Persists conversations and messages, publishes AI requests to NATS, streams AI responses to the frontend via SSE.
- **AI Service** — NestJS microservice. Listens for AI requests on NATS, generates a response, and publishes it back.
- **Logger Service** — NestJS microservice. Listens to NATS events and writes structured logs to disk.
- **PostgreSQL** — Stores conversations and messages.
- **NATS** — Message broker between the API and backend services.
- **Adminer** — Web-based DB admin UI (port 8080, dev mode only exposed).

---

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) v2
- [Node.js](https://nodejs.org/) 20+ and npm (only needed if running services locally outside Docker)

---

## Quick Start (Docker — recommended)

### 1. Copy environment file

```bash
cp .env.example .env
```

The defaults work out of the box. Edit `.env` only if you need custom ports or credentials.

### 2. Start all services

**Development mode** (hot-reload, source mounted into containers):

```bash
docker compose -f docker-compose.dev.yml up --build
```

**Production mode** (optimised builds):

```bash
docker compose up --build
```

### 3. Run database migrations

Migrations must be run once after the containers are up (and again whenever new migrations are added).

```bash
docker compose -f docker-compose.dev.yml exec api npx ts-node \
  -r tsconfig-paths/register \
  ./node_modules/.bin/typeorm migration:run \
  -d apps/api/src/database/data-source.ts
```

For the production compose file, replace `docker-compose.dev.yml` with `docker-compose.yml` and swap `ts-node` for the compiled JS:

```bash
docker compose exec api node dist/apps/api/src/database/data-source.js migration:run
```

### 4. Open the app

| Service    | URL                          |
|------------|------------------------------|
| Frontend   | http://localhost:3001        |
| API        | http://localhost:3000        |
| Adminer    | http://localhost:8080        |
| NATS monitor | http://localhost:8222      |

---

## Running Locally (without Docker)

Use this approach if you want to run the Node services directly on your machine.

### 1. Start infrastructure only

```bash
docker compose -f docker-compose.dev.yml up postgres nats --build
```

This starts PostgreSQL on `localhost:5432` and NATS on `localhost:4222`.

### 2. Install dependencies

```bash
# Root monorepo (API, AI service, Logger service)
npm install

# Frontend
cd apps/frontend && npm install && cd ../..
```

### 3. Set environment variables

Create a `.env` at the project root (or export the variables in your shell):

```bash
cp .env.example .env
```

For the frontend, create `apps/frontend/.env.local`:

```bash
cp apps/frontend/.env.local.example apps/frontend/.env.local
```

### 4. Run migrations

```bash
DATABASE_HOST=localhost npx ts-node \
  -r tsconfig-paths/register \
  ./node_modules/.bin/typeorm migration:run \
  -d apps/api/src/database/data-source.ts
```

### 5. Start each service

Open a separate terminal for each:

```bash
# API
npm run start:api

# AI Service
npm run start:ai

# Logger Service (optional)
npm run start:logger

# Frontend
cd apps/frontend && npm run dev
```

---

## Database Migrations

### Run pending migrations

```bash
# Inside the api container (dev)
docker compose -f docker-compose.dev.yml exec api npx ts-node \
  -r tsconfig-paths/register \
  ./node_modules/.bin/typeorm migration:run \
  -d apps/api/src/database/data-source.ts

# Locally
DATABASE_HOST=localhost npx ts-node \
  -r tsconfig-paths/register \
  ./node_modules/.bin/typeorm migration:run \
  -d apps/api/src/database/data-source.ts
```

### Revert last migration

```bash
# Inside container
docker compose -f docker-compose.dev.yml exec api npx ts-node \
  -r tsconfig-paths/register \
  ./node_modules/.bin/typeorm migration:revert \
  -d apps/api/src/database/data-source.ts

# Locally
DATABASE_HOST=localhost npx ts-node \
  -r tsconfig-paths/register \
  ./node_modules/.bin/typeorm migration:revert \
  -d apps/api/src/database/data-source.ts
```

### Generate a new migration

After modifying an entity, generate a migration automatically:

```bash
DATABASE_HOST=localhost npx ts-node \
  -r tsconfig-paths/register \
  ./node_modules/.bin/typeorm migration:generate \
  apps/api/src/database/migrations/YourMigrationName \
  -d apps/api/src/database/data-source.ts
```

---

## Environment Variables

### Root `.env` (API & services)

| Variable            | Default           | Description                        |
|---------------------|-------------------|------------------------------------|
| `DATABASE_HOST`     | `postgres`        | PostgreSQL hostname                |
| `DATABASE_PORT`     | `5432`            | PostgreSQL port                    |
| `DATABASE_NAME`     | `chatapp`         | Database name                      |
| `DATABASE_USER`     | `chatapp`         | Database user                      |
| `DATABASE_PASSWORD` | `chatapp_secret`  | Database password                  |
| `NATS_URL`          | `nats://nats:4222`| NATS server URL                    |
| `API_PORT`          | `3000`            | Port the API listens on            |
| `FRONTEND_PORT`     | `3001`            | Port the frontend listens on       |

### `apps/frontend/.env.local`

| Variable                | Default                  | Description                    |
|-------------------------|--------------------------|--------------------------------|
| `NEXT_PUBLIC_API_URL`   | `http://localhost:3000`  | API base URL (REST calls)      |
| `NEXT_PUBLIC_SSE_URL`   | `http://localhost:3000`  | API base URL (SSE stream)      |

---

## Useful Commands

```bash
# View logs for a specific service
docker compose -f docker-compose.dev.yml logs -f api

# Rebuild a single service
docker compose -f docker-compose.dev.yml up --build api

# Stop everything and remove volumes (clean slate)
docker compose -f docker-compose.dev.yml down -v

# Run tests
npm test

# Run tests with coverage
npm run test:cov
```

---

## Project Structure

```
.
├── apps/
│   ├── api/              # NestJS REST API
│   ├── ai-service/       # NestJS AI microservice
│   ├── logger-service/   # NestJS logger microservice
│   └── frontend/         # Next.js frontend
├── libs/
│   └── shared/           # Shared DTOs, types, constants
├── docker-compose.yml        # Production compose
├── docker-compose.dev.yml    # Development compose (hot-reload)
├── .env.example              # Root env template
└── package.json              # Monorepo root
```
