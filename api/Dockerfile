FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json ./api/package.json
COPY web/package.json ./web/package.json
RUN npm ci --omit=dev --workspace @petcare/api --no-audit --no-fund
COPY api/src ./api/src
USER node
EXPOSE 3000
CMD ["node", "api/src/index.js"]
