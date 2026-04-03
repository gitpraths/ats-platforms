FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./

# Install all dependencies (including dev for build)
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the React app
RUN npm run build

# ── Production stage ──────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install serve to host the static build
RUN npm install -g serve

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

CMD ["sh", "-c", "serve -s dist -p ${PORT:-3000}"]
