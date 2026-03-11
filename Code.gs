// Code.gs
// GracePulse PWA Backend (Google Apps Script)

const SPREADSHEET_ID = '1QKGzluWoqS_jsQl5v6T4U_tPBicYwP7RlSkDKyoeli8';

// Helper function to return JSON with CORS headers
function buildJsonResponse(payload) {
  const output = ContentService.createTextOutput(JSON.stringify(payload));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// Preflight CORS request handler
function doOptions(e) {
  // We can't actually set Access-Control-Allow-Origin from GAS Web App responses this easily,
  // but GAS handles CORS natively for GET/POST when called correctly from client (e.g. no-cors or jsonp if needed, or straight fetch if published open).
  // Standard practice for GAS JSON API:
  return buildJsonResponse({ status: 'ok' });
}

// GET Request handler
function doGet(e) {
  const action = e.parameter.action;

  try {
    if (action === 'getState') {
      return buildJsonResponse(getState());
    } else {
      return buildJsonResponse({ error: 'Invalid action or missing action parameter' });
    }
  } catch (error) {
    return buildJsonResponse({ error: error.toString() });
  }
}

// POST Request handler
function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;

    if (action === 'lockMonth') {
      const month = postData.month;
      if (!month) throw new Error("Missing 'month' parameter.");
      return buildJsonResponse(lockMonth(month));
    } else if (action === 'addPrimeRate') {
      const date = postData.date;
      const rate = parseFloat(postData.rate);
      if (!date || isNaN(rate)) throw new Error("Missing or invalid 'date' or 'rate' parameters.");
      return buildJsonResponse(addPrimeRate(date, rate));
    } else {
      return buildJsonResponse({ error: 'Invalid action' });
    }
  } catch (error) {
    return buildJsonResponse({ error: error.toString() });
  }
}

// --------------------------------------------------------------------------------
// Core Logic
// --------------------------------------------------------------------------------

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getState() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 1. Read Ledger
  const ledgerSheet = ss.getSheetByName('Monthly_Ledger');
  const ledgerData = ledgerSheet.getDataRange().getValues();
  const ledgerHeaders = ledgerData.shift();

  const ledger = ledgerData.map(row => {
    let obj = {};
    ledgerHeaders.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });

  // 2. Read Milestones
  const milestoneSheet = ss.getSheetByName('Milestones');
  const milestoneData = milestoneSheet.getDataRange().getValues();
  const milestoneHeaders = milestoneData.shift();

  const milestones = milestoneData.map(row => {
    let obj = {};
    milestoneHeaders.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });

  // 3. Read Prime Rates
  const primeSheet = ss.getSheetByName('Prime_Rates');
  const primeData = primeSheet.getDataRange().getValues();
  const primeHeaders = primeData.shift();

  const primeRates = primeData.map(row => {
    let obj = {};
    primeHeaders.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });

  // Calculate Aggregates
  let liquidBalance = 0;
  let totalDrawn = 0;

  // Liquid Balance = Last locked month's End_Balance
  for (let i = ledger.length - 1; i >= 0; i--) {
    if (ledger[i].Is_Locked === true || String(ledger[i].Is_Locked).toUpperCase() === 'TRUE') {
      liquidBalance = parseFloat(ledger[i].End_Balance) || 0;
      break;
    }
  }

  // Total Remaining to Contractor = 1,635,000 - total drawn so far
  // Drawn so far is sum of milestones that have passed (we assume if Date <= today, or we can just sum up from milestones if they have a 'Drawn' status. Assuming Date <= current date for simplicity, or we can check ledger active drawn).
  // For safety, let's sum milestones that have a date before or equal to today.
  const today = new Date();
  milestones.forEach(m => {
    const mDate = new Date(m.Date);
    if (mDate <= today) {
      totalDrawn += parseFloat(m.Amount) || 0;
    }
  });

  const totalRemainingToContractor = 1635000 - totalDrawn;

  // Current prime rate (latest)
  let currentPrimeRate = primeRates.length > 0 ? parseFloat(primeRates[primeRates.length - 1].Rate) : 0;

  return {
    ledger: ledger,
    milestones: milestones,
    primeRates: primeRates,
    aggregates: {
      liquidBalance: liquidBalance,
      totalRemainingToContractor: totalRemainingToContractor,
      totalDrawn: totalDrawn,
      currentPrimeRate: currentPrimeRate
    }
  };
}

function lockMonth(monthStr) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const ledgerSheet = ss.getSheetByName('Monthly_Ledger');
  const data = ledgerSheet.getDataRange().getValues();
  const headers = data[0];
  const monthIndex = headers.indexOf('Month');
  const lockedIndex = headers.indexOf('Is_Locked');

  if (monthIndex === -1 || lockedIndex === -1) {
    throw new Error("Ledger sheet missing 'Month' or 'Is_Locked' columns.");
  }

  let found = false;
  // Row 1 is headers, data starts at index 1 (row 2)
  for (let i = 1; i < data.length; i++) {
    // Convert sheet month value to string to compare
    let rowMonth = data[i][monthIndex];
    if (rowMonth instanceof Date) {
      rowMonth = rowMonth.toISOString().slice(0, 7); // YYYY-MM
    } else {
      rowMonth = String(rowMonth).trim();
    }

    if (rowMonth === monthStr) {
      // Set to TRUE
      ledgerSheet.getRange(i + 1, lockedIndex + 1).setValue(true);
      found = true;
      break;
    }
  }

  if (!found) {
    throw new Error("Month " + monthStr + " not found in ledger.");
  }

  recalculateLedger(ss);
  return getState();
}

function addPrimeRate(dateStr, rate) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const primeSheet = ss.getSheetByName('Prime_Rates');

  // Append row
  primeSheet.appendRow([dateStr, rate]);

  recalculateLedger(ss);
  return getState();
}

// --------------------------------------------------------------------------------
// Recalculation Engine
// --------------------------------------------------------------------------------

function recalculateLedger(ss) {
  if (!ss) ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  const ledgerSheet = ss.getSheetByName('Monthly_Ledger');
  const ledgerRange = ledgerSheet.getDataRange();
  const ledgerData = ledgerRange.getValues();
  const ledgerHeaders = ledgerData[0];

  const milestoneSheet = ss.getSheetByName('Milestones');
  const milestoneData = milestoneSheet.getDataRange().getValues();
  const milestoneHeaders = milestoneData[0];

  const primeSheet = ss.getSheetByName('Prime_Rates');
  const primeData = primeSheet.getDataRange().getValues();
  const primeHeaders = primeData[0];

  // Build helper indexes for Ledger
  const idx = {
    Month: ledgerHeaders.indexOf('Month'),
    Is_Locked: ledgerHeaders.indexOf('Is_Locked'),
    Rom_Actual: ledgerHeaders.indexOf('Rom_Actual'),
    Rom_Planned: ledgerHeaders.indexOf('Rom_Planned'),
    Yael_Actual: ledgerHeaders.indexOf('Yael_Actual'),
    Yael_Planned: ledgerHeaders.indexOf('Yael_Planned'),
    Deposit_Actual: ledgerHeaders.indexOf('Deposit_Actual'),
    Deposit_Planned: ledgerHeaders.indexOf('Deposit_Planned'),
    Grace_Deduction: ledgerHeaders.indexOf('Grace_Deduction'),
    End_Balance: ledgerHeaders.indexOf('End_Balance')
  };

  // Build Milestones Objects
  const milestones = [];
  for (let i = 1; i < milestoneData.length; i++) {
    let m = {};
    milestoneHeaders.forEach((h, j) => m[h] = milestoneData[i][j]);
    milestones.push(m);
  }

  // Build Prime Rates Objects
  const primeRates = [];
  for (let i = 1; i < primeData.length; i++) {
    let p = {};
    primeHeaders.forEach((h, j) => p[h] = primeData[i][j]);
    primeRates.push(p);
  }

  // Helper to get applicable Prime Rate for a given month Date object
  function getApplicablePrimeRate(targetMonthDate) {
    let applicableRate = 0;
    // Iterate through append-only prime rates to find the latest one on or before targetMonthDate
    for (let i = 0; i < primeRates.length; i++) {
      let pDate = new Date(primeRates[i].Date || primeRates[i].Effective_Month);
      if (pDate <= targetMonthDate) {
         applicableRate = parseFloat(primeRates[i].Rate || primeRates[i].Prime_Rate_Value);
      }
    }
    return applicableRate;
  }

  // Helper to get active drawn funds for each track up to a given month Date object
  function getActiveDrawnFunds(targetMonthDate) {
    let drawn = { Mishtana: 0, Kavua: 0, Prime: 0 };
    for (let i = 0; i < milestones.length; i++) {
      let mDate = new Date(milestones[i].Date);
      // If milestone date is before or strictly equal to the target month
      if (mDate <= targetMonthDate) {
        let track = String(milestones[i].Track).toLowerCase();
        let amount = parseFloat(milestones[i].Amount) || 0;
        if (track.includes('mishtana')) drawn.Mishtana += amount;
        else if (track.includes('kavua')) drawn.Kavua += amount;
        else if (track.includes('prime')) drawn.Prime += amount;
      }
    }
    return drawn;
  }

  // Iterate ledger and recalculate unlocked rows
  for (let i = 1; i < ledgerData.length; i++) {
    let row = ledgerData[i];
    let isLocked = row[idx.Is_Locked];

    // Strict Constraint: IMMUTABLE if locked
    if (isLocked === true || String(isLocked).toUpperCase() === 'TRUE') {
      continue;
    }

    // It's unlocked. We need the previous row's End Balance.
    let prevEndBalance = 0;
    if (i > 1) {
      prevEndBalance = parseFloat(ledgerData[i-1][idx.End_Balance]) || 0;
    }

    // Determine Inflows
    let rom = parseFloat(row[idx.Rom_Actual]) > 0 ? parseFloat(row[idx.Rom_Actual]) : (parseFloat(row[idx.Rom_Planned]) || 0);
    let yael = parseFloat(row[idx.Yael_Actual]) > 0 ? parseFloat(row[idx.Yael_Actual]) : (parseFloat(row[idx.Yael_Planned]) || 0);
    let deposit = parseFloat(row[idx.Deposit_Actual]) > 0 ? parseFloat(row[idx.Deposit_Actual]) : (parseFloat(row[idx.Deposit_Planned]) || 0);

    let totalInflow = rom + yael + deposit;

    // Determine current month Date for comparisons
    let currentMonthStr = row[idx.Month];
    let currentMonthDate = new Date(currentMonthStr);
    // If it's a string like '2025-10', parse it properly
    if (isNaN(currentMonthDate.getTime())) {
      currentMonthDate = new Date(currentMonthStr + '-01T00:00:00');
    }

    // Active Drawn Funds
    let activeFunds = getActiveDrawnFunds(currentMonthDate);

    // Interest Rates
    const mishtanaRate = 0.0485;
    const kavuaRate = 0.0480;
    let basePrimeRatePercent = getApplicablePrimeRate(currentMonthDate);
    // basePrimeRatePercent is expected to be e.g. 5.5 (meaning 5.5%). If it's already a decimal like 0.055, adjust accordingly.
    // Assuming the sheet stores it as 5.5 for 5.5%. So we divide by 100.
    let primeRateDecimal = (basePrimeRatePercent / 100) - 0.007; // P-0.7%

    // Grace Formula
    let graceDeduction = (activeFunds.Mishtana * mishtanaRate / 12) +
                         (activeFunds.Kavua * kavuaRate / 12) +
                         (activeFunds.Prime * primeRateDecimal / 12);

    // End Balance
    let endBalance = prevEndBalance + totalInflow - graceDeduction;

    // Update local data array (so next iterations see the updated prevEndBalance)
    ledgerData[i][idx.Grace_Deduction] = graceDeduction;
    ledgerData[i][idx.End_Balance] = endBalance;

    // Write back to sheet immediately for this row (1-based index + header row = i + 1)
    ledgerSheet.getRange(i + 1, idx.Grace_Deduction + 1).setValue(graceDeduction);
    ledgerSheet.getRange(i + 1, idx.End_Balance + 1).setValue(endBalance);
  }
}
