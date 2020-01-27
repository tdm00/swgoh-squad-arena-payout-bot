const Discord = require("discord.js")
const XLSX = require("xlsx")

const https = require("https")
const path = require("path")
const fs = require("fs")
require("./global")

module.exports = class Bot {
  constructor (botToken) {
    this.main = this.main.bind(this)

    this.botToken = botToken
    this.client = new Discord.Client()
    this.client.on("ready", async () => {
      // this.client.user.setActivity('live countdowns until payout')
      this.channel = this.client.channels.get(global.channelId)

      await this.initializeBot()
      console.log('Bot initialized')
    })
	
	console.log('Registering xlxs reload command')
	
	// Bad way to handle commands, however there's only a couple so it is reasonable for now
	this.client.on('message', msg => {
	  if (msg.content === '!reloadxlsx' && msg.member != null && msg.member.hasPermission('ADMINISTRATOR')) {
		this.reloadXlsx()
	  }
	  else if (msg.content === "!uploadxlsx" && (msg.author.id.toString() === global.botAdmin || msg.author.id.toString() === '115349553770659841')) {
		  console.log("Running !uploadxlsx")
		  if (msg.attachments.array().length === 0){
		      msg.reply("No attachment found to the command, please attach the file, then add the text to be `!uploadxlsx`")
		  }
		  else if (msg.attachments.array().length !== 1) {
			  msg.reply("More than one attachment found, please only include 1 xlsx")
		  }
		  else{
		     var attachment = msg.attachments.first()
			 const file = fs.createWriteStream(this.sheetFullPath, {flags: 'w'});
			 // Discord uploads attachements to https
             const request = https.get(attachment.url, function(response) {
                 response.pipe(file);
             });
			 msg.reply('Done')
			 this.reloadXlsx()
			 
		  }
	  }
	});

    console.log('Bot logging into discord')
    this.client.login(botToken)
	console.log('Done')
	
	console.log('Loading xlxs')
    this.reloadXlsx()
	console.log('Done')

    this.main()
  }

  async main () {
    try {
      if (this.message) {
        this.calculateSecondsUntilPayout()
		console.log('Sending payout discord embed')
        await this.sendMessage()
      }
    } catch (err) {
      console.log(err)
    } finally {
      setTimeout(this.main, 60000 - Date.now() % 60000)
    }
  }

  async initializeBot () {
	  
    const messages = await this.channel.fetchMessages()
    console.log('Messages in embed channel: ' + messages.array().length)
	if (messages.array().length === 0) {
      try {
        this.message = await this.channel.send({embed: new Discord.RichEmbed()})
      } catch (err) {
        console.log(err)
      }
    } else {
      if (messages.first().embeds.length === 0) {
        await messages.first().delete()
        this.message = await this.channel.send({embed: new Discord.RichEmbed()})
      } else {
        this.message = messages.first()
      }
    }
  }
  
  reloadXlsx() {
	var files = fs.readdirSync(path.resolve(__dirname, '..'));
    console.log('Found ' + files.length + ' files in directory')
	for(var i in files) {
		console.log('Searching: ' + files[i])
	   if(path.extname(files[i]) === ".xlsx") {
		   console.log("Found and parsing xlxs: '" + files[i] + "'")
		    this.sheetFullPath = path.resolve(__dirname, '..', files[i])
		    this.sheet = XLSX.utils.sheet_to_json(XLSX.readFile(this.sheetFullPath).Sheets.Sheet1)
		    this.parseXlsx()
		    return
	   }
	}

  }
  
  parseXlsx () {
    this.mates = []
    for (let i in this.sheet) {
      const user = this.sheet[i]
      this.mates.push({
        name: user.Name,
        payout: parseInt(user.UTC.substr(0,2)),
        discordId: user.ID,
        flag: user.Flag,
        swgoh: user.SWGOH
      })
    }
    const matesByTime = {}
    for (let i in this.mates) {
      const mate = this.mates[i]
      if (!matesByTime[mate.payout]) {
        matesByTime[mate.payout] = {
          payout: mate.payout,
          mates: []
        }
      }
      matesByTime[mate.payout].mates.push(mate)
    }
    this.mates = Object.values(matesByTime)
	
	// Now we don't use the XLSX again, unless reloaded, which will add itself again anyway, and run this again.
	delete this.sheet
  }

  calculateSecondsUntilPayout () {
    const now = new Date()
    for (let i in this.mates) {
      const mate = this.mates[i]
      const p = new Date()
      p.setUTCHours(mate.payout, 0, 0, 0)
      if (p < now) p.setDate(p.getDate() + 1)
      mate.timeUntilPayout = p.getTime() - now.getTime()
      let dif = new Date(mate.timeUntilPayout)
      const round = dif.getTime() % 60000
      if (round < 30000) {
        dif.setTime(dif.getTime() - round)
      } else {
        dif.setTime(dif.getTime() + 60000 - round)
      }
      mate.time = `${String(dif.getUTCHours()).padStart(2, '00')}:${String(dif.getUTCMinutes()).padStart(2, '00')}`
    }
    this.mates.sort((a, b) => {
      return a.timeUntilPayout - b.timeUntilPayout
    })
  }

  async sendMessage () {
    let embed = new Discord.RichEmbed().setColor(0x00AE86)
	let desc = global.embedHeaderText
    desc += '\r\n\r\n**Time until next payout**:'
    for (let i in this.mates) {
      let fieldName = String(this.mates[i].time)
      let fieldText = ''
      for (const mate of this.mates[i].mates) {
        fieldText += `${mate.flag} [${mate.name}](${mate.swgoh})\n` // Discord automatically trims messages
      }
      embed.addField(fieldName, fieldText, true) // true: inline mode
           .setTimestamp()
    }
    embed.setDescription(desc)
    await this.message.edit({embed})
  }
}
