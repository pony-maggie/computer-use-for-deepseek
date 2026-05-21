FROM node:22-slim AS build

WORKDIR /app/web

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY --from=build /app/web/dist /usr/share/nginx/html

EXPOSE 80
