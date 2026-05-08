const test = require("node:test");
const assert = require("node:assert/strict");

const payoutData = require("../src/payoutData");

const REQUIRED_COLUMNS = ["Name", "UTC", "ID", "Flag", "SWGOH"];

test("parseSheetRows parses valid rows and skips invalid rows", () => {
  const rows = [
    {
      Name: "Alpha",
      UTC: "17:00",
      ID: "123",
      Flag: ":flag:",
      SWGOH: "https://swgoh.gg/p/1/"
    },
    {
      Name: "MissingUtc",
      UTC: "",
      ID: "124",
      Flag: ":flag:",
      SWGOH: "https://swgoh.gg/p/2/"
    },
    {
      Name: "BadUtc",
      UTC: "99:00",
      ID: "125",
      Flag: ":flag:",
      SWGOH: "https://swgoh.gg/p/3/"
    }
  ];

  const result = payoutData.parseSheetRows(rows, REQUIRED_COLUMNS);
  assert.equal(result.errors.length, 0);
  assert.equal(result.mates.length, 1);
  assert.equal(result.skippedRows, 2);
  assert.equal(result.mates[0].name, "Alpha");
  assert.equal(result.mates[0].payout, 17);
});

test("parseSheetRows returns error for missing required columns", () => {
  const rows = [{ Name: "Alpha", UTC: "17:00" }];
  const result = payoutData.parseSheetRows(rows, REQUIRED_COLUMNS);

  assert.equal(result.mates.length, 0);
  assert.ok(
    result.errors.some(message =>
      message.includes("Spreadsheet is missing required columns")
    )
  );
});

test("groupMatesByPayout groups mates by payout hour", () => {
  const mates = [
    { name: "A", payout: 17 },
    { name: "B", payout: 17 },
    { name: "C", payout: 19 }
  ];
  const groups = payoutData.groupMatesByPayout(mates);
  const group17 = groups.find(group => group.payout === 17);
  const group19 = groups.find(group => group.payout === 19);

  assert.ok(group17);
  assert.ok(group19);
  assert.equal(group17.mates.length, 2);
  assert.equal(group19.mates.length, 1);
});

test("calculateSecondsUntilPayout sorts soonest payout first", () => {
  const groups = [
    { payout: 17, mates: [{ name: "Late" }] },
    { payout: 16, mates: [{ name: "Soon" }] }
  ];

  const fixedNow = new Date(Date.UTC(2026, 0, 1, 15, 30, 0));
  payoutData.calculateSecondsUntilPayout(groups, fixedNow);

  assert.equal(groups[0].payout, 16);
  assert.equal(groups[0].time, "00:30");
  assert.equal(groups[1].payout, 17);
  assert.equal(groups[1].time, "01:30");
});
