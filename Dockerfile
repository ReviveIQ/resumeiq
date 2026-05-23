FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Install dependencies (no frozen lockfile since we modified package.json)
RUN pnpm install --no-frozen-lockfile

# Copy all source files
COPY . .

# Build the app
RUN pnpm build

EXPOSE 3000

CMD ["node", "dist/index.js"]
