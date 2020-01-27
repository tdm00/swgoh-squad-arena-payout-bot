const Discord = require("discord.js")
const XLSX = require("xlsx")

const path = require("path")
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
	
	this.client.on('message', msg => {
	  if (msg.content === '!reloadxlsx' && msg.member != null && msg.member.hasPermission('ADMINISTRATOR')) {
		this.reloadXlsx()
	  }
	});

    this.client.login(botToken)
	
    this.reloadXlsx()

    this.main()
  }

  async main () {
    try {
      if (this.message) {
        this.calculateSecondsUntilPayout()
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
	var fs = require('fs')
	var files = fs.readdirSync(__dirname);

	for(var i in files) {
	   if(path.extname(files[i]) === ".xlxs") {
		   console.log("Found and parsing xlxs: '" + files[i] + "'")
		    this.sheet = XLSX.utils.sheet_to_json(XLSX.readFile(path.resolve(__dirname, files[i])).Sheets.Sheet1)
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
