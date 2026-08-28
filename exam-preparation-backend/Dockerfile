FROM node:20 AS base
WORKDIR /app

FROM base AS deps
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=1
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile --ignore-scripts; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm i --frozen-lockfile --ignore-scripts; \
  else npm ci --ignore-scripts; fi

FROM base AS builder
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prisma Client üret (schema artık içeride)
RUN npx prisma generate
# Build (varsa)
RUN if grep -q 'tsc' package.json; then npm run build || yarn build || pnpm build; else echo "No build step"; fi

FROM node:20 AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
RUN mkdir -p /app/uploads && chown -R appuser:appgroup /app/uploads
USER appuser
EXPOSE 4000
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "dist/server.js"]
