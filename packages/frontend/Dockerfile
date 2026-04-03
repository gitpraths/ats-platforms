FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install --legacy-peer-deps

COPY . .

# Accept VITE_API_URL at build time so Vite compiles it into the bundle
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Production stage ──────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy package.json so Node treats server.js as an ES module ("type": "module")
COPY --from=builder /app/package.json ./package.json

# Copy built frontend files
COPY --from=builder /app/dist ./dist

# Copy the static server (no dependencies needed — uses Node built-ins only)
COPY --from=builder /app/server.js ./server.js

EXPOSE 3000

CMD ["node", "server.js"]
