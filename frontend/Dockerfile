# Build context is the repository root, so nginx/default.conf is reachable.

FROM node:22-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# The frontend tests share fixtures with the server: the test videos of the browser check
# (specs/002 research R12) and the cases of the completeness check (specs/006 research R5).
COPY backend/tests/fixtures/ /backend/tests/fixtures/
RUN npm run build

FROM nginx:stable-alpine
# Which nginx config goes into the image. default.conf (HTTPS with a certificate) for local use
# and CI; default.prod.conf (plain HTTP behind the webserver of the VPS) for the image that goes
# to GHCR: docker build --build-arg NGINX_CONF=default.prod.conf ...
ARG NGINX_CONF=default.conf
COPY nginx/${NGINX_CONF} /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
