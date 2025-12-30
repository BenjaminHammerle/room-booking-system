
FROM node:20-alpine

WORKDIR /app

# Kopiere package files
COPY package*.json ./

# Installiere dependencies
RUN npm ci --only=production

# Kopiere den Rest
COPY . .

# Baue die App
RUN npm run build

# Expose Port
EXPOSE 3000

# Starte die App
CMD ["npm", "start"]