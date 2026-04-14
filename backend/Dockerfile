FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY jest.config.js ./

EXPOSE 4000

CMD ["npm", "run", "start:docker"]
