FROM node:22.12.0-bookworm-slim AS build

WORKDIR /app
ARG NPM_VERSION=10.9.2
ARG NPM_REGISTRY=
ARG HTTP_PROXY=
ARG HTTPS_PROXY=
ARG NO_PROXY=
ENV CI=true
ENV npm_config_audit=false
ENV npm_config_fund=false
ENV npm_config_progress=false
ENV npm_config_update_notifier=false
ENV HTTP_PROXY=${HTTP_PROXY}
ENV HTTPS_PROXY=${HTTPS_PROXY}
ENV NO_PROXY=${NO_PROXY}
ENV http_proxy=${HTTP_PROXY}
ENV https_proxy=${HTTPS_PROXY}
ENV no_proxy=${NO_PROXY}
RUN if [ -n "${NPM_REGISTRY}" ]; then npm config set registry "${NPM_REGISTRY}"; fi
RUN if [ -n "${HTTP_PROXY}" ]; then npm config set proxy "${HTTP_PROXY}"; fi
RUN if [ -n "${HTTPS_PROXY}" ]; then npm config set https-proxy "${HTTPS_PROXY}"; fi
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
