# Debian-based image: bcrypt ships prebuilt binaries for it, so no compiler is needed.
FROM node:24-slim

WORKDIR /app

# Install packages first, in their own layer. Docker reuses this layer on
# rebuilds as long as package.json and package-lock.json haven't changed.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production

# Don't run as root inside the container.
USER node

EXPOSE 3000

# Docker marks the container unhealthy if /health stops answering.
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:' + (process.env.SERVER_PORT || 3000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Exec form, so SIGTERM reaches Node and the graceful shutdown in server.js runs.
CMD ["node", "server.js"]
