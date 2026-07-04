# HUDDLE

HUDDLE is a collaborative communication platform foundation for Quick Rooms and Groups.

This repository currently contains only the project architecture. Authentication, database models, APIs, sockets, and product pages are intentionally not implemented yet.

## Stack

- Turborepo monorepo
- Next.js 15, React 19, TypeScript, Tailwind CSS v4
- Express 5, TypeScript
- Prisma, PostgreSQL
- Redis, BullMQ, Socket.IO
- Shared TypeScript package

## Getting Started

Install dependencies:

```bash
npm install
```

Start PostgreSQL and Redis:

```bash
docker compose up
```

Start the web and server apps:

```bash
npm run dev
```

The web app runs on `http://localhost:3000`.

The backend runs on `http://localhost:4000` and returns `Huddle Backend Running` from `GET /`.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run typecheck
```
