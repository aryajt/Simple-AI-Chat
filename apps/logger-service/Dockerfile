FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build:logger

CMD ["node", "dist/apps/logger-service/apps/logger-service/src/main.js"]
