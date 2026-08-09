# ─── Build Stage ───────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

RUN npm run build

# Fail the build loudly here instead of shipping a broken image
RUN test -f dist/main.js || (echo "BUILD FAILED: dist/main.js was not produced by 'npm run build'" && ls -la dist && exit 1)

# ─── Production Stage ──────────────────────────────────────
FROM node:20-alpine AS production

RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev && npx prisma generate

COPY --from=builder /app/dist ./dist

# Verify the artifact made it into the final image too
RUN test -f dist/main.js || (echo "IMAGE BUILD FAILED: dist/main.js missing from production stage" && exit 1)

USER nestjs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/v1/health || exit 1

CMD ["node", "dist/main.js"]
