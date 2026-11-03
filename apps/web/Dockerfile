# ==============================================================================
# BrewLite Web (Next.js) Multi-stage Dockerfile
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Dependencies Installation
# ------------------------------------------------------------------------------
FROM node:22-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

# ------------------------------------------------------------------------------
# Stage 2: Application Build
# ------------------------------------------------------------------------------
FROM node:22-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Injected at build-time because Next.js inlines NEXT_PUBLIC_* variables in client bundles
ARG NEXT_PUBLIC_API_URL=http://localhost:3005/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npm run build

# ------------------------------------------------------------------------------
# Stage 3: Production Runner
# ------------------------------------------------------------------------------
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3006

# Setup unprivileged user with valid home directory
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -m -d /home/nextjs nextjs

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next

# Ensure static asset folder exists
RUN mkdir -p ./public

RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3006

CMD ["npm", "run", "start"]
