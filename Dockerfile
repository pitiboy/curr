# Path 1: CI/GitHub Actions builds this image (8–16 GB RAM).
# Do not `strapi build` on Fly's small builder.
# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS build

WORKDIR /opt/app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG NODE_OPTIONS=--max-old-space-size=1536
ENV NODE_OPTIONS=${NODE_OPTIONS}
ENV NODE_ENV=production
ENV DATABASE_CLIENT=sqlite

# Dummy keys exist only for `strapi build` in this stage (same names as CI).
RUN APP_KEYS=test-key-1,test-key-2,test-key-3,test-key-4 \
  API_TOKEN_SALT=ci-api-token-salt \
  ADMIN_JWT_SECRET=ci-admin-jwt-secret \
  TRANSFER_TOKEN_SALT=ci-transfer-token-salt \
  JWT_SECRET=ci-jwt-secret \
  ENCRYPTION_KEY=ci-encryption-key \
  npm run build

FROM node:20-bookworm-slim AS runtime

WORKDIR /opt/app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=1337

COPY --from=build /opt/app /opt/app
RUN chown -R node:node /opt/app

USER node

EXPOSE 1337

CMD ["npm", "start"]
