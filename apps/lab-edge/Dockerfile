FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json ./
COPY src ./src
# Wave 2+: install serialport / sqlite drivers when enabling physical analyzers
CMD ["node", "--import", "tsx", "src/cli.ts"]
