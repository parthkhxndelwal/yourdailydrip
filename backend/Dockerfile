# syntax=docker/dockerfile:1

# Production image for the Medusa backend app (@dtc/backend) inside the npm
# turbo monorepo at backend/. Layout inside the image mirrors the repo:
#
#   /app
#   ├── package.json / package-lock.json / node_modules  (npm workspace root)
#   └── apps/backend                                      (medusa app, built)
#
# Build: `medusa build` (turbo build) compiles the server to
# apps/backend/.medusa/server and the admin dashboard bundle to
# apps/backend/.medusa/server/public/admin, then copies it to
# apps/backend/public/admin (the path `medusa start` expects at boot).
# Run:   `medusa start` (apps/backend `start` script) serves both on :9000.

FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
# Only the workspace manifests are needed to resolve the lockfile; npm ci
# re-reads the allowScripts allow-list from root package.json so the
# esbuild/swc/msgpackr/protobufjs/telemetry install scripts run in-image.
COPY package.json package-lock.json .npmrc ./
# patches/ feeds the root postinstall hook ("patch-package"), which reapplies
# the medusa-plugin-razorpay-v2 fixes during npm ci (scripts run in-image; no
# --ignore-scripts). Without it, postinstall would no-op and the build would
# ship the unpatched plugin.
COPY patches ./patches
COPY apps/backend/package.json apps/backend/package.json
RUN npm ci

FROM node:20-alpine AS build
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# medusa build does not boot providers, so no env vars are required; the CORS
# defaults below only guard against any build-time evaluation of medusa-config.
ENV STORE_CORS=http://localhost:5173 \
    ADMIN_CORS=http://localhost:9000 \
    AUTH_CORS=http://localhost:5173
RUN npm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NODE_ENV=production
# Full node_modules (dev deps included): medusa-config.ts is loaded at startup
# via jiti, a root devDependency - pruning dev deps would break boot.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
COPY --from=build /app/apps ./apps
WORKDIR /app/apps/backend
EXPOSE 9000
CMD ["npm", "start"]
