# Deploy the application

now rm swgoh-squad-arena-payout-bot -y && now deploy --docker --public --dotenv=.env --force

export NOW_URL=https://

# Scale application to a single instance

now scale \$NOW_URL sfo1 0 1

# Put the bot to sleep for new deployment

now scale \$NOW_URL sfo1 0 0
