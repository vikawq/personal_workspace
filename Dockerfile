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
RUN npm ci --include=dev --no-audit --no-fund --loglevel=warn

COPY . .
RUN npm run build:frontend

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
