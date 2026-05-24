FROM node:20.11.0-alpine

WORKDIR /app

COPY package.json ./

RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["node_modules/.bin/tsx", "server/_core/index.ts"]
