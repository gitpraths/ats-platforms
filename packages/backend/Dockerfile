FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --production --legacy-peer-deps

# Copy source code (v2 — candidate-pool route added)
COPY src/ ./src/

# Create uploads directory
RUN mkdir -p uploads

CMD ["sh", "-c", "node src/server.js"]
