# HUDDLE

HUDDLE is a production-ready collaboration SaaS for creating focused realtime rooms. Teams can create quick temporary rooms, persistent groups, anonymous guest spaces, QR-shareable links, realtime chat, typing indicators, presence, uploads, and room analytics.

## Architecture

- `apps/web`: Next.js 15, React 19, Auth.js, Tailwind CSS v4, Socket.IO client.
- `apps/server`: Express 5 API, Socket.IO realtime gateway, Prisma, PostgreSQL, Redis, BullMQ worker, Cloudinary uploads.
- `packages/shared`: Shared TypeScript types, Zod schemas, constants, and helpers.

## Features

- Google authentication through Auth.js with backend JWT session bridging.
- Dashboard for room creation, editing, deletion, analytics, QR codes, and search.
- Quick Rooms with optional expiry and passcodes.
- Group rooms for persistent team collaboration.
- Realtime chat with optimistic messages, typing indicators, presence, reconnect handling, and missed-message recovery.
- File and image uploads through Cloudinary with MIME and size validation.
- Dark mode, responsive layouts, accessible dialogs/forms, and production metadata.

## Screenshots

Add project screenshots here before publishing:

- Landing page
- Dashboard
- Chat room
- Mobile chat
- Dark mode

## Tech Stack

- Next.js, React, TypeScript, Tailwind CSS, Radix UI, Framer Motion
- Express, Socket.IO, Prisma, PostgreSQL
- Redis, BullMQ
- Cloudinary
- Turborepo, npm workspaces

## Folder Structure

```text
apps/
  web/       Next.js web application
  server/    Express API, realtime gateway, worker, Prisma schema
packages/
  shared/    Shared schemas, constants, helpers, and types
```

## Local Setup

```bash
npm install
cp .env.example .env
docker compose up postgres redis
npm run db:generate
npm --workspace @huddle/server run db:migrate
npm run dev
```

The web app runs at `http://localhost:3000`.
The API runs at `http://localhost:4000`.

## Environment Variables

Use `.env.example` for local development and `.env.production.example` for hosted deployments.

Required production groups:

- Database: `DATABASE_URL`, `DIRECT_URL`
- Redis: `REDIS_URL`
- Auth: `AUTH_SECRET`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`
- URLs/CORS: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BACKEND_URL`, `NEXTAUTH_URL`, `CORS_ORIGIN`, `SOCKET_CORS_ORIGIN`
- Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

Generate secrets with:

```bash
openssl rand -base64 32
```

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
npm run db:generate
npm run db:migrate:deploy
```

## Deployment

### Vercel Web

1. Create a Vercel project from this repository.
2. Set the root directory to `apps/web`.
3. Add web env vars from `.env.production.example`.
4. Set `NEXT_PUBLIC_BACKEND_URL` to the deployed API URL.
5. Deploy with the default Next.js build command.

### Railway API And Worker

1. Create a Railway service for the API using `apps/server/Dockerfile`.
2. Create a second Railway service from the same Dockerfile for the worker.
3. Set the worker start command to:

```bash
npm --workspace @huddle/server run start:worker
```

4. Add production env vars and run Prisma migrations:

```bash
npm run db:migrate:deploy
```

### Neon PostgreSQL

1. Create a Neon project and database.
2. Use the pooled connection string for `DATABASE_URL`.
3. Use the direct connection string for `DIRECT_URL`.
4. Keep SSL enabled for production.

### Redis

Use Railway Redis, Upstash Redis, or another managed Redis service. Set `REDIS_URL` to the provider connection string. Use `rediss://` when TLS is required.

### Cloudinary

Create a Cloudinary project and add the cloud name, API key, and API secret. HUDDLE stores room uploads in structured Cloudinary folders.

### Docker Compose

For a production-like local stack:

```bash
docker compose up --build
```

The compose file starts web, server, worker, PostgreSQL, and Redis.
It uses internal Docker service URLs by default. Override `COMPOSE_DATABASE_URL`, `COMPOSE_DIRECT_URL`, or `COMPOSE_REDIS_URL` only when pointing containers at external managed services.

## Production Checks

Before shipping:

```bash
npm run lint
npm run typecheck
npm run build
npm run test
```

Also verify auth, dashboard CRUD, quick rooms, groups, realtime chat, typing, presence, uploads, analytics, responsive layouts, and dark mode.

## Future Scope

- Organization workspaces and billing
- Role-based group permissions
- Message search and retention policies
- Audit logs
- E2E test coverage with Playwright

## License

MIT
