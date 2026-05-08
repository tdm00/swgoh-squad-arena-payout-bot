const {
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  PermissionFlagsBits
} = require("discord.js");
const XLSX = require("xlsx");

const path = require("path");
const fs = require("fs");
const { pipeline } = require("stream/promises");
const { Readable } = require("stream");

try {
  require("./global");
} catch (err) {
  if (err.code !== "MODULE_NOT_FOUND") throw err;
}
const payoutData = require("./payoutData");
const DEFAULT_XLSX_FILENAME = "SWGoH_Shard.xlsx";
const REQUIRED_SHEET_COLUMNS = ["Name", "UTC", "ID", "Flag", "SWGOH"];

module.exports = class Bot {
  constructor(botToken, deps = {}) {
    this.main = this.main.bind(this);

    const ClientImpl = deps.Client ?? Client;
    const autoLogin = deps.autoLogin !== false;
    const runMainLoop = deps.runMainLoop !== false;
    const loadSpreadsheetOnStart = deps.loadSpreadsheetOnStart !== false;

    this.botToken = botToken;
    this.client = new ClientImpl({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    if (typeof deps.downloadAttachmentToSheet === "function") {
      this.downloadAttachmentToSheet = deps.downloadAttachmentToSheet.bind(this);
    }

    this.client.once(Events.ClientReady, async () => {
      try {
        this.channel = await this.client.channels.fetch(global.channelId);
      } catch (err) {
        console.error(
          "Failed to fetch payout channel '" + global.channelId + "': " + err.message
        );
        return;
      }

      await this.initializeBot();
      console.log("Bot initialized");
    });

    console.log("Registering xlsx reload command");

    this.client.on(Events.MessageCreate, async msg => {
      if (msg.author.bot) return;

      if (
        msg.content === "!reloadxlsx" &&
        msg.member != null &&
        msg.member.permissions.has(PermissionFlagsBits.Administrator)
      ) {
        this.reloadXlsx();
      } else if (msg.content === "!uploadxlsx") {
        const adminId = String(global.botAdmin);
        if (msg.author.id !== adminId) {
          msg.reply("You do not have permission to run that command");
          return;
        }
        console.log("Running !uploadxlsx");
        const attachments = [...msg.attachments.values()];
        if (attachments.length === 0) {
          msg.reply(
            "No attachment found to the command, please attach the file, then add the text to be `!uploadxlsx`"
          );
        } else if (attachments.length !== 1) {
          msg.reply(
            "More than one attachment found, please only include 1 xlsx"
          );
        } else {
          const attachment = attachments[0];
          try {
            await this.downloadAttachmentToSheet(attachment.url);
            console.log("The file is finished downloading.");
            this.reloadXlsx();
            await this.sendMessage();
            msg.reply("Done");
          } catch (error) {
            console.error("Upload failed: " + error.message);
            msg.reply("Download failed: " + error.message);
          }
        }
      }
    });

    if (autoLogin) {
      console.log("Bot logging into discord");
      this.client.login(botToken);
    }
    console.log("Done");

    if (loadSpreadsheetOnStart) {
      console.log("Loading xlsx");
      this.reloadXlsx();
      console.log("Done");
    }

    if (runMainLoop) {
      this.main();
    }
  }

  async downloadAttachmentToSheet(url) {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; swgoh-payout-bot/1.0; +https://github.com/)"
      }
    });
    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }
    if (!response.body) {
      throw new Error("Empty response body");
    }
    await pipeline(
      Readable.fromWeb(response.body),
      fs.createWriteStream(this.sheetFullPath, { flags: "w" })
    );
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
    const fetched = await this.channel.messages.fetch({ limit: 50 });
    const messages = [...fetched.values()].sort(
      (a, b) => b.createdTimestamp - a.createdTimestamp
    );
    console.log("Messages in embed channel: " + messages.length);
    if (messages.length === 0) {
      try {
        this.message = await this.channel.send({
          embeds: [new EmbedBuilder()]
        });
      } catch (err) {
        console.log(err);
      }
    } else {
      const newest = messages[0];
      if (newest.embeds.length === 0) {
        await newest.delete();
        this.message = await this.channel.send({
          embeds: [new EmbedBuilder()]
        });
      } else {
        this.message = newest;
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
    const result = payoutData.parseSheetRows(this.sheet, REQUIRED_SHEET_COLUMNS);
    result.errors.forEach(error => console.error(error));
    result.warnings.forEach(warning => console.warn(warning));

    if (result.errors.length > 0) {
      this.mates = [];
      return;
    }

    this.mates = payoutData.groupMatesByPayout(result.mates);

    var key,
      count = 0;

    for (key in this.mates) {
      if (this.mates.hasOwnProperty(key)) count++;
    }
    console.log("Shard mates found: " + count);

    delete this.sheet;
  }

  calculateSecondsUntilPayout() {
    payoutData.calculateSecondsUntilPayout(this.mates, new Date());
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

    let desc = global.embedHeaderText || "";
    desc += "\r\n\r\n**Time until next payout**:";
    const embed = new EmbedBuilder().setColor(0x00ae86).setDescription(desc);

    for (let i in this.mates) {
      let fieldName = String(this.mates[i].time);
      let fieldText = "";
      for (const mate of this.mates[i].mates) {
        fieldText += `${mate.flag} [${mate.name}](${mate.swgoh})\n`;
      }
      embed.addFields({ name: fieldName, value: fieldText, inline: true });
    }
    embed.setTimestamp(new Date());

    try {
      await this.message.edit({ embeds: [embed] });
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
