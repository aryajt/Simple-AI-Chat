FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build:ai

EXPOSE 3002

CMD ["node", "dist/apps/ai-service/apps/ai-service/src/main.js"]