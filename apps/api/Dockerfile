# ==============================================================================
# BrewLite API (NestJS + Prisma) Multi-stage Dockerfile
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Dependencies & Prisma Generation
# ------------------------------------------------------------------------------
FROM node:22-slim AS deps
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci
RUN npx prisma generate

# ------------------------------------------------------------------------------
# Stage 2: Application Build
# ------------------------------------------------------------------------------
FROM node:22-slim AS builder
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/prisma ./prisma
COPY . .

RUN npm run build

# ------------------------------------------------------------------------------
# Stage 3: Production Runner
# ------------------------------------------------------------------------------
FROM node:22-slim AS runner
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3005

# Setup unprivileged user with valid home directory
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -m -d /home/nestjs nestjs

COPY --chown=nestjs:nodejs --from=builder /app/package.json ./package.json
COPY --chown=nestjs:nodejs --from=builder /app/tsconfig.json ./tsconfig.json
COPY --chown=nestjs:nodejs --from=builder /app/prisma ./prisma
COPY --chown=nestjs:nodejs --from=builder /app/node_modules ./node_modules
COPY --chown=nestjs:nodejs --from=builder /app/dist ./dist

USER nestjs

EXPOSE 3005

CMD ["node", "dist/main"]
