FROM node:22-bookworm-slim
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm install

COPY backend backend
RUN npm run db:generate --workspace backend
RUN npm run build --workspace backend

ENV NODE_ENV=production
EXPOSE 4000
CMD ["sh", "-c", "npm run db:deploy --workspace backend && if [ \"$SEED_SAMPLE_DATA\" = \"true\" ]; then npm run db:seed --workspace backend; fi && node backend/dist/server.js"]
