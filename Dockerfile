FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["sh", "-c", "npx ts-node -r dotenv/config src/ingest.ts && npx ts-node -r dotenv/config src/server/server.ts"]