# SWGOH Shard Payout

A Discord bot which parses an xlsx document to write payouts in a Discord channel.

## Installation

- install Node >= 24 LTS
- git clone the repository
- run `npm install` in its folder
- visit https://discord.com/developers/applications and make a new application. Convert it to a bot
- under **Bot**, enable the **Message Content Intent** (required for `!reloadxlsx` / `!uploadxlsx` text commands)
- make a file `src/global.js` with `global.botToken = 'Paste your token here'`
- add the bot to your Discord server
- make a dedicated channel for the payouts and give the bot full access to it
- get the channel ID for the payout channel
  - User Settings
  - Appearance
  - Enable Developer Mode
   (enable dev options in Discord, right-click the channel and copy ID)
- go to `src/global.js` and add the new line `global.channelId = 'Your channel id here'`
- go to `src/global.js` and add the new line `global.embedHeaderText = 'Your custom description here'`, leave it blank `global.embedHeaderText = ''` for none 
- go to `src/global.js` and add the new line `global.botAdmin = 'Your discord user id string'` (same id used for `!uploadxlsx`)
- optional: set `global.xlsxFilename = 'SWGoH_Shard.xlsx'` to use a custom XLSX filename (defaults to `SWGoH_Shard.xlsx`)
- make your changes to the xlsx file. Do not change its layout or column names
- run `npm start`

OR

- (optional) if you want to run it indefinitely, I suggest to use pm2:
  - run `npm i -g pm2`
  - run `pm2 start ./src/index.js --name="swgoh-payout"`
