FROM node:22.12.0-bookworm-slim AS build

WORKDIR /app
ARG NPM_VERSION=10.9.2
ENV CI=true
ENV npm_config_audit=false
ENV npm_config_fund=false
ENV npm_config_progress=false
ENV npm_config_update_notifier=false
RUN npm install -g npm@${NPM_VERSION} --no-audit --no-fund --loglevel=warn
COPY package*.json ./
COPY .npmrc ./
COPY backend/tsconfig.json backend/tsconfig.json
COPY backend/src backend/src
RUN npm ci --include=dev --no-audit --no-fund --loglevel=warn
RUN npm run backend:build

FROM node:22.12.0-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_FILE=/data/workbench.json
COPY --from=build /app/backend/dist backend/dist

EXPOSE 3000
CMD ["node", "backend/dist/server.js"]
