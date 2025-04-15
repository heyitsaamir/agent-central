FROM --platform=linux/amd64 node:20-alpine AS base

FROM base AS builder
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune standupagent --docker

FROM base AS installer
RUN apk update
RUN apk add --no-cache libc6-compat
WORKDIR /app

# First install dependencies (as they change less often)
COPY --from=builder /app/out/json/ .
RUN npm install
RUN npm install turbo -D

# Build the project and its dependencies
COPY --from=builder /app/out/full/ .
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npx turbo run build --no-daemon

FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Copy built application
COPY --from=installer /app/apps/standupagent/dist ./dist
COPY --from=installer /app/apps/standupagent/package.json .
COPY --from=installer /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV PORT=8080

CMD ["npm", "start"]
