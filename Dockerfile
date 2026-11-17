# Stage 1: Build the web frontend
FROM node:22-alpine AS web-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build

# Stage 2: Build the server
FROM node:22-alpine AS server-builder
WORKDIR /app
COPY server/package*.json ./server/
RUN apk add --no-cache python3 make g++ sqlite-dev && \
    cd server && npm install
COPY server/ ./server/

# Stage 3: Production
FROM node:22-alpine
WORKDIR /app

# Install native deps for better-sqlite3 in production
RUN apk add --no-cache python3 make g++ sqlite-dev

COPY server/package*.json ./server/
RUN cd server && npm install --production

COPY server/ ./server/
COPY --from=web-builder /app/web/dist ./public

RUN mkdir -p /app/data && chown -R node:node /app

USER node
ENV PORT=8585
ENV DATA_DIR=/app/data
ENV WEB_DIST=/app/public

EXPOSE 8585

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD node -e "fetch('http://localhost:8585/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server/src/index.js"]
