FROM node:20-alpine

WORKDIR /app

# Install only production dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Applications are written here - mount a volume to keep them across restarts
RUN mkdir -p /app/data
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
