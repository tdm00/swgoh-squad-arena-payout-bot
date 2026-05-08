const assert = require("node:assert/strict");
const test = require("node:test");
const { Events, PermissionFlagsBits } = require("discord.js");

global.botToken = "test-token";
global.channelId = "channel-1";
global.embedHeaderText = "";
global.botAdmin = "admin-user";

const Bot = require("../src/Bot");

/**
 * Minimal Discord client stub: registers handlers only (no gateway).
 */
class MockDiscordClient {
  constructor(_options) {
    this._onceHandlers = new Map();
    this._onHandlers = new Map();
    this.channels = {
      fetch: async () => {
        throw new Error("MockDiscordClient: channels.fetch not stubbed");
      }
    };
  }

  once(event, handler) {
    this._onceHandlers.set(event, handler);
  }

  on(event, handler) {
    const list = this._onHandlers.get(event) || [];
    list.push(handler);
    this._onHandlers.set(event, list);
  }

  login() {
    return Promise.resolve();
  }

  async dispatch(event, payload) {
    if (event === Events.ClientReady) {
      const handler = this._onceHandlers.get(event);
      if (handler) await handler(payload);
      return;
    }
    const list = this._onHandlers.get(event) || [];
    await Promise.all(list.map(handler => handler(payload)));
  }
}

function fakeMessage(overrides) {
  const replies = [];
  const msg = {
    author: { id: "someone", bot: false },
    content: "",
    member: null,
    attachments: {
      values() {
        return [].values();
      }
    },
    async reply(text) {
      replies.push(text);
    },
    ...overrides
  };
  return { msg, replies };
}

test("Bot registers ClientReady and MessageCreate handlers on mock client", () => {
  const mock = new MockDiscordClient();
  new Bot("fake-token", {
    Client: function ctor(opts) {
      return mock;
    },
    autoLogin: false,
    runMainLoop: false,
    loadSpreadsheetOnStart: false
  });

  assert.ok(mock._onceHandlers.has(Events.ClientReady));
  const messageHandlers = mock._onHandlers.get(Events.MessageCreate) || [];
  assert.equal(messageHandlers.length, 1);
});

test("!reloadxlsx invokes reloadXlsx when sender is guild administrator", async () => {
  const mock = new MockDiscordClient();
  const bot = new Bot("fake-token", {
    Client: function ctor() {
      return mock;
    },
    autoLogin: false,
    runMainLoop: false,
    loadSpreadsheetOnStart: false
  });

  let reloadCalls = 0;
  bot.reloadXlsx = () => {
    reloadCalls++;
  };

  const { msg } = fakeMessage({
    content: "!reloadxlsx",
    member: {
      permissions: {
        has(bit) {
          return bit === PermissionFlagsBits.Administrator;
        }
      }
    }
  });

  await mock.dispatch(Events.MessageCreate, msg);
  assert.equal(reloadCalls, 1);
});

test("!reloadxlsx does nothing when sender lacks Administrator", async () => {
  const mock = new MockDiscordClient();
  const bot = new Bot("fake-token", {
    Client: function ctor() {
      return mock;
    },
    autoLogin: false,
    runMainLoop: false,
    loadSpreadsheetOnStart: false
  });

  let reloadCalls = 0;
  bot.reloadXlsx = () => {
    reloadCalls++;
  };

  const { msg } = fakeMessage({
    content: "!reloadxlsx",
    member: {
      permissions: {
        has() {
          return false;
        }
      }
    }
  });

  await mock.dispatch(Events.MessageCreate, msg);
  assert.equal(reloadCalls, 0);
});

test("!uploadxlsx rejects non-admin users", async () => {
  const mock = new MockDiscordClient();
  new Bot("fake-token", {
    Client: function ctor() {
      return mock;
    },
    autoLogin: false,
    runMainLoop: false,
    loadSpreadsheetOnStart: false
  });

  const { msg, replies } = fakeMessage({
    author: { id: "not-admin", bot: false },
    content: "!uploadxlsx"
  });

  await mock.dispatch(Events.MessageCreate, msg);
  assert.equal(replies.length, 1);
  assert.ok(replies[0].includes("permission"));
});

test("!uploadxlsx prompts when admin sends no attachment", async () => {
  const mock = new MockDiscordClient();
  new Bot("fake-token", {
    Client: function ctor() {
      return mock;
    },
    autoLogin: false,
    runMainLoop: false,
    loadSpreadsheetOnStart: false
  });

  const { msg, replies } = fakeMessage({
    author: { id: "admin-user", bot: false },
    content: "!uploadxlsx",
    attachments: {
      values() {
        return [].values();
      }
    }
  });

  await mock.dispatch(Events.MessageCreate, msg);
  assert.equal(replies.length, 1);
  assert.ok(replies[0].includes("No attachment"));
});

test("!uploadxlsx happy path downloads attachment then reloads and sends embed", async () => {
  const mockUrl = "https://cdn.discord.example/attachments/file.xlsx";
  let downloadedUrl = null;
  let reloadCalls = 0;
  let sendCalls = 0;

  const mock = new MockDiscordClient();
  const bot = new Bot("fake-token", {
    Client: function ctor() {
      return mock;
    },
    autoLogin: false,
    runMainLoop: false,
    loadSpreadsheetOnStart: false,
    downloadAttachmentToSheet: async function (url) {
      downloadedUrl = url;
    }
  });

  bot.reloadXlsx = () => {
    reloadCalls++;
  };
  bot.sendMessage = async () => {
    sendCalls++;
  };

  const { msg, replies } = fakeMessage({
    author: { id: "admin-user", bot: false },
    content: "!uploadxlsx",
    attachments: {
      values() {
        return [{ url: mockUrl }].values();
      }
    }
  });

  await mock.dispatch(Events.MessageCreate, msg);

  assert.equal(downloadedUrl, mockUrl);
  assert.equal(reloadCalls, 1);
  assert.equal(sendCalls, 1);
  assert.deepEqual(replies, ["Done"]);
});
