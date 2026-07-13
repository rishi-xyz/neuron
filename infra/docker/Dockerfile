# ---------- build ----------
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

# Copy all package files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ packages/
COPY apps/ apps/
COPY workers/ workers/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build all packages
RUN pnpm build

# ---------- production ----------
FROM node:22-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app
ENV NODE_ENV=production

# Copy package files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ packages/
COPY apps/ apps/
COPY workers/ workers/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built artifacts
COPY --from=builder /app/packages/*/dist packages/*/dist/
COPY --from=builder /app/apps/*/dist apps/*/dist/
COPY --from=builder /app/workers/*/dist workers/*/dist/

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/slack-agent/dist/index.js"]
