// db_controllers.gs
// GracePulse PWA Backend - Database Controllers

const SPREADSHEET_ID = '1QKGzluWoqS_jsQl5v6T4U_tPBicYwP7RlSkDKyoeli8';

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getState() {
  const ss = getSpreadsheet();

  // Read Sheets
  const ledgerData = _readSheet(ss, 'Monthly_Ledger');
  const milestonesData = _readSheet(ss, 'Milestones');
  const primeRatesData = _readSheet(ss, 'Prime_Rates');
  const indexData = _readSheet(ss, 'Construction_Index');
  const settingsData = _readSheet(ss, 'System_Settings');

  // Convert settings to Key-Value Map
  const settings = {};
  settingsData.forEach(row => {
    if (row.Key) settings[row.Key] = row.Value;
  });

  // Calculate Aggregates
  let liquidBalance = 0;
  let totalDrawnPrincipalOnly = 0;
  let totalDrawnAll = 0;

  for (let i = ledgerData.length - 1; i >= 0; i--) {
    if (String(ledgerData[i].Is_Locked).toUpperCase() === 'TRUE') {
      liquidBalance = parseFloat(ledgerData[i].End_Balance) || 0;
      break;
    }
  }

  const today = new Date();
  milestonesData.forEach(m => {
    const mDate = _parseDate(m.Date);
    if (mDate <= today) {
      const amt = parseFloat(m.Amount) || 0;
      totalDrawnAll += amt;
      if (String(m.Track) !== 'Index_Linkage_Charge') {
         totalDrawnPrincipalOnly += amt;
      }
    }
  });

  const contractAmount = parseFloat(settings['Total_Contract_Amount']) || 1635000;
  const totalRemainingToContractor = contractAmount - totalDrawnPrincipalOnly;

  const currentPrimeRate = primeRatesData.length > 0 ? parseFloat(primeRatesData[primeRatesData.length - 1].Prime_Rate_Value || primeRatesData[primeRatesData.length - 1].Rate) : 0;
  const currentIndexValue = indexData.length > 0 ? parseFloat(indexData[indexData.length - 1].Index_Value) : 0;

  return {
    ledger: ledgerData,
    milestones: milestonesData,
    primeRates: primeRatesData,
    constructionIndices: indexData,
    settings: settings,
    aggregates: {
      liquidBalance: liquidBalance,
      totalRemainingToContractor: totalRemainingToContractor,
      totalDrawn: totalDrawnAll,
      currentPrimeRate: currentPrimeRate,
      currentIndexValue: currentIndexValue
    }
  };
}

// Write Controllers

function lockMonth(monthStr) {
  return _withLock(() => {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Monthly_Ledger');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const monthIndex = headers.indexOf('Month');
    const lockedIndex = headers.indexOf('Is_Locked');

    if (monthIndex === -1 || lockedIndex === -1) throw new Error("Missing Month or Is_Locked columns in Ledger.");

    let found = false;
    for (let i = 1; i < data.length; i++) {
      let rowMonth = data[i][monthIndex];
      if (rowMonth instanceof Date) {
        rowMonth = rowMonth.toISOString().slice(0, 7);
      } else {
        rowMonth = String(rowMonth).trim();
      }

      if (rowMonth === monthStr) {
        sheet.getRange(i + 1, lockedIndex + 1).setValue(true);
        found = true;
        break;
      }
    }

    if (!found) throw new Error("Month " + monthStr + " not found.");

    recalculateGrace(ss);
    return getState();
  });
}

function updateInflows(monthStr, rom, yael, deposit) {
  return _withLock(() => {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Monthly_Ledger');
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const monthIndex = headers.indexOf('Month');
    const romIdx = headers.indexOf('Rom_Actual') !== -1 ? headers.indexOf('Rom_Actual') : headers.indexOf('Actual_Rom');
    const yaelIdx = headers.indexOf('Yael_Actual') !== -1 ? headers.indexOf('Yael_Actual') : headers.indexOf('Actual_Yael');
    const depIdx = headers.indexOf('Deposit_Actual') !== -1 ? headers.indexOf('Deposit_Actual') : headers.indexOf('Actual_Deposit');

    if (monthIndex === -1) throw new Error("Missing Month column.");

    let found = false;
    for (let i = 1; i < data.length; i++) {
      let rowMonth = data[i][monthIndex];
      if (rowMonth instanceof Date) {
        rowMonth = rowMonth.toISOString().slice(0, 7);
      } else {
        rowMonth = String(rowMonth).trim();
      }

      if (rowMonth === monthStr) {
        if (romIdx !== -1) sheet.getRange(i + 1, romIdx + 1).setValue(rom);
        if (yaelIdx !== -1) sheet.getRange(i + 1, yaelIdx + 1).setValue(yael);
        if (depIdx !== -1) sheet.getRange(i + 1, depIdx + 1).setValue(deposit);
        found = true;
        break;
      }
    }

    if (!found) throw new Error("Month " + monthStr + " not found.");

    recalculateGrace(ss);
    return getState();
  });
}

function addPrimeRate(dateStr, rate) {
  return _withLock(() => {
    const ss = getSpreadsheet();
    ss.getSheetByName('Prime_Rates').appendRow([dateStr, rate]);
    recalculateGrace(ss);
    return getState();
  });
}

function addConstructionIndex(dateStr, indexValue) {
  return _withLock(() => {
    const ss = getSpreadsheet();
    ss.getSheetByName('Construction_Index').appendRow([dateStr, indexValue]);
    return getState();
  });
}

function appendIndexLinkage(dateStr, amount) {
  return _withLock(() => {
    const ss = getSpreadsheet();
    // Appends to Milestones: Date, Amount, Track, Status
    ss.getSheetByName('Milestones').appendRow([dateStr, amount, 'Index_Linkage_Charge', 'TRUE']);
    recalculateGrace(ss);
    return getState();
  });
}

// Helpers

function _readSheet(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 1) return [];
  const headers = data.shift();
  return data.map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function _parseDate(dateStr) {
  if (dateStr instanceof Date) return dateStr;
  let d = new Date(dateStr);
  if (isNaN(d.getTime())) d = new Date(String(dateStr) + '-01T00:00:00');
  return d;
}

function _withLock(callback) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    return callback();
  } catch (e) {
    throw new Error("Could not acquire lock: " + e.message);
  } finally {
    lock.releaseLock();
  }
}
