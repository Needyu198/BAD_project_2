FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY . .

EXPOSE 5001
CMD ["sh", "-c", "npm run db:migrate && npm start"]
