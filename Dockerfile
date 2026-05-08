FROM node:24-alpine

WORKDIR /var/swgoh-squad-arena-payout-bot

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
