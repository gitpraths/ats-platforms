FROM node:20-alpine AS builder

WORKDIR /app

# Accept VITE_API_URL at build time so Vite compiles it into the bundle
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Copy source first — ensures ANY file change invalidates all layers below
COPY . .

# Install dependencies (runs fresh whenever source changes)
RUN npm install --legacy-peer-deps

# Build production bundle
RUN npm run build

# ── Production stage ──────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install serve globally — battle-tested static server for Railway
RUN npm install -g serve

# Copy built frontend files
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["sh", "-c", "serve -s dist -l ${PORT:-3000}"]
