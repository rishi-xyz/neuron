# ---------- build ----------
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/slack-agent/package.json apps/slack-agent/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter slack-agent build

# ---------- production ----------
FROM node:22-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json ./
COPY --from=builder /app/packages/shared/package.json packages/shared/
COPY --from=builder /app/packages/shared/dist packages/shared/dist/
COPY --from=builder /app/apps/slack-agent/package.json apps/slack-agent/
COPY --from=builder /app/apps/slack-agent/dist apps/slack-agent/dist/
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "apps/slack-agent/dist/index.js"]
