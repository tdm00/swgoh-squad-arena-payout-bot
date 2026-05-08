function parseSheetRows(sheetRows, requiredColumns) {
  if (!Array.isArray(sheetRows)) {
    return {
      mates: [],
      skippedRows: 0,
      errors: ["Spreadsheet parse failed: expected an array of rows."],
      warnings: []
    };
  }

  if (sheetRows.length === 0) {
    return {
      mates: [],
      skippedRows: 0,
      errors: [
        "Spreadsheet is empty. Expected columns: " + requiredColumns.join(", ")
      ],
      warnings: []
    };
  }

  const discoveredColumns = Object.keys(sheetRows[0] || {});
  const missingColumns = requiredColumns.filter(
    columnName => discoveredColumns.indexOf(columnName) === -1
  );
  if (missingColumns.length > 0) {
    return {
      mates: [],
      skippedRows: 0,
      errors: [
        "Spreadsheet is missing required columns: " + missingColumns.join(", "),
        "Found columns: " + (discoveredColumns.join(", ") || "(none)")
      ],
      warnings: []
    };
  }

  const mates = [];
  const warnings = [];
  let skippedRows = 0;

  for (let i = 0; i < sheetRows.length; i++) {
    const user = sheetRows[i];
    const rowNumber = i + 2; // +1 for header row, +1 for 1-based index
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
      warnings.push(
        "Skipping row " +
          rowNumber +
          ": required data missing (Name, UTC, ID, Flag, SWGOH)."
      );
      continue;
    }

    if (Number.isNaN(parsedPayout) || parsedPayout < 0 || parsedPayout > 23) {
      skippedRows++;
      warnings.push(
        "Skipping row " +
          rowNumber +
          ": invalid UTC value '" +
          user.UTC +
          "'. Expected hour in 24h format (00-23)."
      );
      continue;
    }

    mates.push({
      name: user.Name,
      payout: parsedPayout,
      discordId: user.ID,
      flag: user.Flag,
      swgoh: user.SWGOH
    });
  }

  const errors = [];
  if (mates.length === 0) {
    errors.push(
      "No valid rows found in spreadsheet after validation. " +
        skippedRows +
        " row(s) were skipped."
    );
  }

  return { mates, skippedRows, errors, warnings };
}

function groupMatesByPayout(mates) {
  const matesByTime = {};
  for (let i = 0; i < mates.length; i++) {
    const mate = mates[i];
    if (!matesByTime[mate.payout]) {
      matesByTime[mate.payout] = {
        payout: mate.payout,
        mates: []
      };
    }
    matesByTime[mate.payout].mates.push(mate);
  }
  return Object.values(matesByTime);
}

function calculateSecondsUntilPayout(matesByPayout, now) {
  const currentTime = now || new Date();
  for (let i = 0; i < matesByPayout.length; i++) {
    const mate = matesByPayout[i];
    const p = new Date(currentTime.getTime());
    p.setUTCHours(mate.payout, 0, 0, 0);
    if (p < currentTime) p.setDate(p.getDate() + 1);

    mate.timeUntilPayout = p.getTime() - currentTime.getTime();
    const dif = new Date(mate.timeUntilPayout);
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

  matesByPayout.sort((a, b) => {
    return a.timeUntilPayout - b.timeUntilPayout;
  });
}

module.exports = {
  parseSheetRows,
  groupMatesByPayout,
  calculateSecondsUntilPayout
};
