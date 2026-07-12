# syntax=docker/dockerfile:1

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json turbo.json tsconfig.base.json prisma.config.ts ./
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/server apps/server
COPY packages/shared packages/shared
RUN npm ci
RUN npm --workspace @huddle/server run db:generate
RUN npm --workspace @huddle/server run build
RUN npm prune --omit=dev --workspaces

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache tini
COPY --from=builder /app/package.json /app/package-lock.json /app/prisma.config.ts ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "--workspace", "@huddle/server", "run", "start"]
