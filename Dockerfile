FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --no-frozen-lockfile --shamefully-hoist

COPY . .

RUN pnpm build

EXPOSE 3000

CMD ["node", "dist/index.js"]
