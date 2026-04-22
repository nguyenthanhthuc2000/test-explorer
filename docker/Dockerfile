FROM node:22-bookworm-slim

WORKDIR /app

# System deps for Playwright will be added later when we run browser in-container.
# For now this Dockerfile is a placeholder for a future "core runner" service.

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

CMD ["node", "-e", "console.log('core runner placeholder')"]

