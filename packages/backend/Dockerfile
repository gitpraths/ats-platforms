FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY src/ ./src/

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 3001

CMD ["node", "src/server.js"]
