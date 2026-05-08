const Discord = require("discord.js");
const XLSX = require("xlsx");

const path = require("path");
const fs = require("fs");
require("./global");
const DEFAULT_XLSX_FILENAME = "SWGoH_Shard.xlsx";
const REQUIRED_SHEET_COLUMNS = ["Name", "UTC", "ID", "Flag", "SWGOH"];

module.exports = class Bot {
  constructor(botToken) {
    this.main = this.main.bind(this);

    this.botToken = botToken;
    this.client = new Discord.Client();
    this.client.on("ready", async () => {
      // this.client.user.setActivity('live countdowns until payout')
      this.channel = this.client.channels.get(global.channelId);

      await this.initializeBot();
      console.log("Bot initialized");
    });

    console.log("Registering xlxs reload command");

    // Bad way to handle commands, however there's only a couple so it is reasonable for now
    this.client.on("message", async msg => {
      if (
        msg.content === "!reloadxlsx" &&
        msg.member != null &&
        msg.member.hasPermission("ADMINISTRATOR")
      ) {
        this.reloadXlsx();
      } else if (msg.content === "!uploadxlsx") {
        if (
          msg.author.id.toString() !== global.botAdmin &&
          msg.author.id != OAuth2Application.owner.id
        ) {
          msg.reply("You do not have permission to run that command");
          return;
        }
        console.log("Running !uploadxlsx");
        if (msg.attachments.array().length === 0) {
          msg.reply(
            "No attachment found to the command, please attach the file, then add the text to be `!uploadxlsx`"
          );
        } else if (msg.attachments.array().length !== 1) {
          msg.reply(
            "More than one attachment found, please only include 1 xlsx"
          );
        } else {
          var attachment = msg.attachments.first();
          const file = fs.createWriteStream(this.sheetFullPath, { flags: "w" });
          const request = require("request");

          await new Promise((resolve, reject) => {
            let stream = request({
              uri: attachment.url,
              headers: {
                Accept:
                  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language":
                  "en-US,en;q=0.9,fr;q=0.8,ro;q=0.7,ru;q=0.6,la;q=0.5,pt;q=0.4,de;q=0.3",
                "Cache-Control": "max-age=0",
                Connection: "keep-alive",
                "Upgrade-Insecure-Requests": "1",
                "User-Agent":
                  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36"
              },
              /* GZIP true for most of the websites now, disable it if you don't need it */
              gzip: true
            })
              .pipe(file)
              .on("finish", () => {
                console.log(`The file is finished downloading.`);
                resolve();
                this.reloadXlsx();
                this.sendMessage();
                msg.reply("Done");
              })
              .on("error", error => {
                reject(error);
              });
          }).catch(error => {
            console.log(`Something happened: ${error}`);
          });
        }
      }
    });

    console.log("Bot logging into discord");
    this.client.login(botToken);
    console.log("Done");

    console.log("Loading xlxs");
    this.reloadXlsx();
    console.log("Done");

    this.main();
  }

  async main() {
    try {
      if (this.message) {
        this.calculateSecondsUntilPayout();
        console.log("Sending payout discord embed");
        await this.sendMessage();
      }
    } catch (err) {
      console.log(err);
    } finally {
      setTimeout(this.main, 60000 - (Date.now() % 60000));
    }
  }

  async initializeBot() {
    const messages = await this.channel.fetchMessages();
    console.log("Messages in embed channel: " + messages.array().length);
    if (messages.array().length === 0) {
      try {
        this.message = await this.channel.send({
          embed: new Discord.RichEmbed()
        });
      } catch (err) {
        console.log(err);
      }
    } else {
      if (messages.first().embeds.length === 0) {
        await messages.first().delete();
        this.message = await this.channel.send({
          embed: new Discord.RichEmbed()
        });
      } else {
        this.message = messages.first();
      }
    }
  }

  reloadXlsx() {
    const rootDir = path.resolve(__dirname, "..");
    const configuredFileName = global.xlsxFilename || DEFAULT_XLSX_FILENAME;
    this.sheetFullPath = path.resolve(rootDir, configuredFileName);

    if (!fs.existsSync(this.sheetFullPath)) {
      console.error(
        "XLSX not found at path: '" +
          this.sheetFullPath +
          "'. Set global.xlsxFilename or add the file."
      );
      return;
    }

    console.log("Loading xlsx: '" + configuredFileName + "'");
    try {
      const workbook = XLSX.readFile(this.sheetFullPath);
      if (!workbook.Sheets || !workbook.Sheets.Sheet1) {
        console.error(
          "Could not find worksheet 'Sheet1' in file: '" +
            configuredFileName +
            "'"
        );
        return;
      }

      this.sheet = XLSX.utils.sheet_to_json(workbook.Sheets.Sheet1);
      console.log(
        "Loaded " +
          this.sheet.length +
          " row(s) from worksheet 'Sheet1' in '" +
          configuredFileName +
          "'."
      );
      this.parseXlsx();
    } catch (error) {
      console.error(
        "Failed to read xlsx file '" + configuredFileName + "': " + error.message
      );
    }
  }

  parseXlsx() {
    if (!Array.isArray(this.sheet)) {
      console.error("Spreadsheet parse failed: expected an array of rows.");
      this.mates = [];
      return;
    }

    if (this.sheet.length === 0) {
      console.error(
        "Spreadsheet is empty. Expected columns: " +
          REQUIRED_SHEET_COLUMNS.join(", ")
      );
      this.mates = [];
      return;
    }

    const discoveredColumns = Object.keys(this.sheet[0] || {});
    const missingColumns = REQUIRED_SHEET_COLUMNS.filter(
      columnName => discoveredColumns.indexOf(columnName) === -1
    );
    if (missingColumns.length > 0) {
      console.error(
        "Spreadsheet is missing required columns: " + missingColumns.join(", ")
      );
      console.error(
        "Found columns: " + (discoveredColumns.join(", ") || "(none)")
      );
      this.mates = [];
      return;
    }

    if (this.mates != null) {
      delete this.mates;
    }
    this.mates = [];
    let skippedRows = 0;
    for (let i in this.sheet) {
      const user = this.sheet[i];
      const rowNumber = parseInt(i, 10) + 2; // +1 for header row, +1 for 1-based index
      const utcValue = String(user.UTC || "");
      const parsedPayout = parseInt(utcValue.substr(0, 2), 10);
      const hasAllFields =
        user.Name != null &&
        user.ID != null &&
        user.Flag != null &&
        user.SWGOH != null &&
        utcValue.length >= 2;

      if (!hasAllFields) {
        skippedRows++;
        console.warn(
          "Skipping row " +
            rowNumber +
            ": required data missing (Name, UTC, ID, Flag, SWGOH)."
        );
        continue;
      }

      if (Number.isNaN(parsedPayout) || parsedPayout < 0 || parsedPayout > 23) {
        skippedRows++;
        console.warn(
          "Skipping row " +
            rowNumber +
            ": invalid UTC value '" +
            user.UTC +
            "'. Expected hour in 24h format (00-23)."
        );
        continue;
      }

      this.mates.push({
        name: user.Name,
        payout: parsedPayout,
        discordId: user.ID,
        flag: user.Flag,
        swgoh: user.SWGOH
      });
    }

    if (this.mates.length === 0) {
      console.error(
        "No valid rows found in spreadsheet after validation. " +
          skippedRows +
          " row(s) were skipped."
      );
      return;
    }

    if (skippedRows > 0) {
      console.warn(
        "Spreadsheet parsed with warnings: skipped " +
          skippedRows +
          " invalid row(s)."
      );
    }

    const matesByTime = {};
    for (let i in this.mates) {
      const mate = this.mates[i];
      if (!matesByTime[mate.payout]) {
        matesByTime[mate.payout] = {
          payout: mate.payout,
          mates: []
        };
      }
      matesByTime[mate.payout].mates.push(mate);
    }
    this.mates = Object.values(matesByTime);

    var key,
      count = 0;

    // Check if every key has its own property
    for (key in this.mates) {
      if (this.mates.hasOwnProperty(key))
        // If the key is found, add it to the total length
        count++;
    }
    console.log("Shard mates found: " + count);

    // Now we don't use the XLSX again, unless reloaded, which will add itself again anyway, and run this again.
    delete this.sheet;
  }

  calculateSecondsUntilPayout() {
    const now = new Date();
    for (let i in this.mates) {
      const mate = this.mates[i];
      const p = new Date();
      p.setUTCHours(mate.payout, 0, 0, 0);
      if (p < now) p.setDate(p.getDate() + 1);
      mate.timeUntilPayout = p.getTime() - now.getTime();
      let dif = new Date(mate.timeUntilPayout);
      const round = dif.getTime() % 60000;
      if (round < 30000) {
        dif.setTime(dif.getTime() - round);
      } else {
        dif.setTime(dif.getTime() + 60000 - round);
      }
      mate.time = `${String(dif.getUTCHours()).padStart(2, "00")}:${String(
        dif.getUTCMinutes()
      ).padStart(2, "00")}`;
    }
    this.mates.sort((a, b) => {
      return a.timeUntilPayout - b.timeUntilPayout;
    });
  }

  async sendMessage() {
    if (!this.message) {
      console.warn("Skipping embed update: payout message is not initialized.");
      return;
    }

    if (!Array.isArray(this.mates) || this.mates.length === 0) {
      console.warn("Skipping embed update: no payout data is available.");
      return;
    }

    let embed = new Discord.RichEmbed().setColor(0x00ae86);
    let desc = global.embedHeaderText;
    desc += "\r\n\r\n**Time until next payout**:";
    for (let i in this.mates) {
      let fieldName = String(this.mates[i].time);
      let fieldText = "";
      for (const mate of this.mates[i].mates) {
        fieldText += `${mate.flag} [${mate.name}](${mate.swgoh})\n`; // Discord automatically trims messages
      }
      embed
        .addField(fieldName, fieldText, true) // true: inline mode
        .setTimestamp();
    }
    embed.setDescription(desc);
    try {
      await this.message.edit({ embed });
    } catch (error) {
      console.error(
        "Failed to update payout embed message in channel '" +
          global.channelId +
          "': " +
          error.message
      );
    }
  }
};
