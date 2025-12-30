# Dockerfile
FROM node:20-alpine

WORKDIR /app

# ARGs für Build-Zeit
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

# Als ENV setzen für Build
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# Installiere dependencies
COPY package*.json ./
RUN npm ci

# Kopiere den Rest
COPY . .

# Baue die App
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]