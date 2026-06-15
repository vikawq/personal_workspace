FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
COPY backend/tsconfig.json backend/tsconfig.json
COPY backend/src backend/src
RUN npm ci
RUN npm run backend:build

FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_FILE=/data/workbench.json
COPY --from=build /app/backend/dist backend/dist

EXPOSE 3000
CMD ["node", "backend/dist/server.js"]
