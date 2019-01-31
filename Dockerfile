# Start for latest Node on Alpine Linux
FROM node:lts-alpine

# Create directory to hold the app
WORKDIR /var/swgoh-squad-arena-payout-bot

# Copy app dependencies list
# COPY package*.json ./

# Bundle app source
COPY . .

# Install app dependencies for production
RUN npm install --no-optional --no-shrinkwrap --no-package-lock

# Required for deployment to now.sh, but doesn't do anything
EXPOSE 3000

# Start the app
CMD [ "npm", "start" ]
