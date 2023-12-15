# FROM node:18

# WORKDIR /home/app

# COPY . .

# RUN npm install

# EXPOSE 80

# CMD ["npm", "start"]

FROM node:lts-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

FROM node:lts-alpine AS production

WORKDIR /app

COPY --chown=node:node --from=builder /app .

USER node

EXPOSE 80

ENTRYPOINT ["npm", "start"]