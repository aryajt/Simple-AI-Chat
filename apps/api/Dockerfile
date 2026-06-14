FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build:api

EXPOSE 3000

CMD ["node", "dist/apps/api/apps/api/src/main.js"]