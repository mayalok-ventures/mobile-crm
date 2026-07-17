FROM node:18-alpine

# Install build dependencies for native modules (sharp, etc.)
RUN apk add --no-cache python3 make g++ gcc libtool autoconf automake bash vips-dev

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application source code
COPY . .

EXPOSE 5000

ENV PORT=5000
ENV NODE_ENV=production

CMD ["npm", "start"]
