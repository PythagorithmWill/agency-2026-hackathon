### Build stage ###############################################################
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps first (cached layer until package.json changes)
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Copy source and build
COPY . .
ARG BUILD_COMMIT=dev
ARG BUILD_TIMESTAMP
ENV BUILD_COMMIT=$BUILD_COMMIT \
    BUILD_TIMESTAMP=${BUILD_TIMESTAMP:-unknown} \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

### Runtime stage #############################################################
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

# Drop privileges
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs \
 && chown -R nextjs:nodejs /app

COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/src/data ./src/data
COPY --from=builder --chown=nextjs:nodejs /app/sql ./sql
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts

USER nextjs
EXPOSE 3000
CMD ["npm", "start"]
