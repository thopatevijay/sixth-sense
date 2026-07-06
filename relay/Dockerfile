# Relay — standalone Node SSE service (deploy to Railway / Fly / Render; Vercel can't do SSE).
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY public ./public
COPY fixtures ./fixtures
ENV PORT=8787
EXPOSE 8787
CMD ["npx", "tsx", "src/server.ts"]
