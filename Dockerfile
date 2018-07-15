# Start for latest LTS for Node 8
FROM node:8

# Create directory to hold the app
WORKDIR /var/swgoh-squad-arena-payout-bot

# Copy app dependencies list
COPY package*.json ./

# Install app dependencies for production
RUN npm install

# Bundle app source
COPY . .

# Required for deployment to now.sh, but doesn't do anything
EXPOSE 3000

# Start the app
CMD [ "npm", "start" ]
