FROM node:20-alpine

WORKDIR /app

# Installiere dependencies INKLUSIVE TypeScript
COPY package*.json ./
RUN npm ci

# Baue die App (TypeScript ist jetzt da)
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]