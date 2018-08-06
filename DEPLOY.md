# Deploy the application
now deploy --docker --public --no-verify --dotenv=.env --force

export NOW_URL=https://swgoh-squad-arena-payout-bot-oxrekthuyu.now.sh

# Scale application to a single instance
now scale $NOW_URL sfo1 0 1

# Put the bot to sleep for new deployment
now scale $NOW_URL sfo1 0 0
