// db_controllers.gs
// GracePulse PWA Backend - Database Controllers

const SPREADSHEET_ID = '1QKGzluWoqS_jsQl5v6T4U_tPBicYwP7RlSkDKyoeli8';

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getState() {
  const ss = getSpreadsheet();

  // THE FIX: Force recalculation on every app load to sync manual DB edits
  recalculateGrace(ss);

  // Read Sheets
  const ledgerData = _readSheet(ss, 'Monthly_Ledger');
  const milestonesData = _readSheet(ss, 'Milestones');
  const primeRatesData = _readSheet(ss, 'Prime_Rates');
  const indexData = _readSheet(ss, 'Construction_Index');
  const indexLinkageData = _readSheet(ss, 'Index_Linkage');
  const settingsData = _readSheet(ss, 'System_Settings');
  const savingsUpdatesData = _readSheet(ss, 'Savings_Updates');

  // Convert settings to Key-Value Map
  const settings = {};
  settingsData.forEach(row => {
    if (row.Key) settings[row.Key] = row.Value;
  });

  // Calculate Aggregates
  let liquidBalance = 0;
  let totalDrawnPrincipalOnly = 0;
  let totalDrawnAll = 0;
  let totalRemainingGrace = 0;

  for (let i = ledgerData.length - 1; i >= 0; i--) {
    if (String(ledgerData[i].Is_Locked).toUpperCase() === 'TRUE') {
      liquidBalance = parseFloat(ledgerData[i].End_Balance) || 0;
      break;
    }
  }

  ledgerData.forEach(row => {
    if (String(row.Is_Locked).toUpperCase() !== 'TRUE') {
      totalRemainingGrace += parseFloat(row.Grace_Deduction) || 0;
    }
  });

  const today = new Date();
  milestonesData.forEach(m => {
    if (String(m.Is_Drawn).toUpperCase() === 'TRUE') {
      const amt = parseFloat(m.Amount) || 0;
      totalDrawnAll += amt;
      if (String(m.Track) !== 'Index_Linkage_Charge') {
         totalDrawnPrincipalOnly += amt;
      }
    }
  });

  const contractAmount = parseFloat(settings['Total_Contract_Amount']) || 1635000;
  const totalRemainingToContractor = contractAmount - totalDrawnPrincipalOnly;

  let currentPrimeRate = 0;
  primeRatesData
    .map(row => ({ date: _parseDate(row.Effective_Date || row.Date), rate: parseFloat(row.Prime_Rate || row.Prime_Rate_Value || row.Rate) }))
    .filter(row => !isNaN(row.date.getTime()) && row.date <= today && !isNaN(row.rate))
    .sort((a, b) => a.date - b.date)
    .forEach(row => { currentPrimeRate = row.rate; });
  let currentIndexValue = 0;
  indexData
    .map(row => ({ date: _parseDate(row.Effective_Month || row.Date), value: parseFloat(row.Index_Value || row.Value) }))
    .filter(row => !isNaN(row.date.getTime()) && row.date <= today && !isNaN(row.value))
    .sort((a, b) => a.date - b.date)
    .forEach(row => { currentIndexValue = row.value; });
  const baseIndex = parseFloat(settings['Base_Construction_Index']) || 137.7;
  const linkageRate = parseFloat(settings['Legal_Linkage_Rate']) || 0.4;
  const paidIndexLinkage = indexLinkageData.reduce((sum, row) => {
    return String(row.Is_Paid).toUpperCase() === 'TRUE' ? sum + (parseFloat(row.Amount) || 0) : sum;
  }, 0);
  const linkageMilestoneKeys = {};
  indexLinkageData.forEach(row => {
    const key = _parseDate(row.Date).getTime() + '|' + (parseFloat(row.Amount) || 0) + '|' + String(row.Related_Track || '').toLowerCase();
    linkageMilestoneKeys[key] = true;
  });
  const remainingIndexedPrincipal = milestonesData.reduce((sum, row) => {
    const key = _parseDate(row.Date).getTime() + '|' + (parseFloat(row.Amount) || 0) + '|' + String(row.Track || '').toLowerCase();
    return String(row.Is_Drawn).toUpperCase() === 'TRUE' || linkageMilestoneKeys[key] ? sum : sum + (parseFloat(row.Amount) || 0);
  }, 0);
  const expectedIndexLinkage = currentIndexValue > 0
    ? Math.max(0, remainingIndexedPrincipal * linkageRate * ((currentIndexValue / baseIndex) - 1))
    : 0;
  const latestSavings = savingsUpdatesData.length > 0
    ? parseFloat(savingsUpdatesData[savingsUpdatesData.length - 1].Current_Savings) || 0
    : 0;

  return {
    ledger: ledgerData,
    milestones: milestonesData,
    primeRates: primeRatesData,
    constructionIndices: indexData,
    indexLinkage: indexLinkageData,
    settings: settings,
    savingsUpdates: savingsUpdatesData,
    aggregates: {
      liquidBalance: liquidBalance,
      totalRemainingToContractor: totalRemainingToContractor,
      totalRemainingGrace: totalRemainingGrace,
      dedicatedSavings: latestSavings,
      totalDrawn: totalDrawnAll,
      currentPrimeRate: currentPrimeRate,
      currentIndexValue: currentIndexValue,
      indexLinkageTotal: paidIndexLinkage + expectedIndexLinkage,
      indexLinkagePaid: paidIndexLinkage,
      indexLinkageRemaining: expectedIndexLinkage
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

    // Smart Date Parser for matching
    let targetDate = new Date(monthStr);
    if (isNaN(targetDate.getTime())) targetDate = new Date(String(monthStr).trim() + '-01');
    let targetYear = targetDate.getFullYear();
    let targetMonth = targetDate.getMonth();

    let found = false;
    for (let i = 1; i < data.length; i++) {
      let rowMonth = data[i][monthIndex];
      let rowDate = new Date(rowMonth);
      
      if (!isNaN(rowDate.getTime())) {
        // Compare by actual Year and Month, ignoring timezones
        if (rowDate.getFullYear() === targetYear && rowDate.getMonth() === targetMonth) {
          sheet.getRange(i + 1, lockedIndex + 1).setValue(true);
          found = true;
          break;
        }
      } else if (String(rowMonth).trim() === String(monthStr).trim()) {
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
    const lockedIdx = headers.indexOf('Is_Locked');

    if (monthIndex === -1) throw new Error("Missing Month column.");

    // Smart Date Parser for matching
    let targetDate = new Date(monthStr);
    if (isNaN(targetDate.getTime())) targetDate = new Date(String(monthStr).trim() + '-01');
    let targetYear = targetDate.getFullYear();
    let targetMonth = targetDate.getMonth();

    let found = false;
    for (let i = 1; i < data.length; i++) {
      let rowMonth = data[i][monthIndex];
      let rowDate = new Date(rowMonth);

      if (!isNaN(rowDate.getTime())) {
        if (rowDate.getFullYear() === targetYear && rowDate.getMonth() === targetMonth) {
          if (lockedIdx !== -1 && String(data[i][lockedIdx]).toUpperCase() === 'TRUE') throw new Error("Locked months cannot be edited.");
          if (romIdx !== -1) sheet.getRange(i + 1, romIdx + 1).setValue(rom);
          if (yaelIdx !== -1) sheet.getRange(i + 1, yaelIdx + 1).setValue(yael);
          if (depIdx !== -1) sheet.getRange(i + 1, depIdx + 1).setValue(deposit);
          found = true;
          break;
        }
      } else if (String(rowMonth).trim() === String(monthStr).trim()) {
        if (lockedIdx !== -1 && String(data[i][lockedIdx]).toUpperCase() === 'TRUE') throw new Error("Locked months cannot be edited.");
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
    let sheet = ss.getSheetByName('Construction_Index');
    if (!sheet) {
      sheet = ss.insertSheet('Construction_Index');
      sheet.appendRow(['Effective_Month', 'Index_Value']);
    }
    sheet.appendRow([dateStr, indexValue]);
    return getState();
  });
}

function appendIndexLinkage(dateStr, amount) {
  return _withLock(() => {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName('Index_Linkage');
    if (!sheet) {
      sheet = ss.insertSheet('Index_Linkage');
      sheet.appendRow(['Date', 'Amount', 'Related_Track', 'Is_Paid']);
    }
    sheet.appendRow([dateStr, amount, '', true]);
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

function updateDedicatedSavings(dateStr, amount, note) {
  return _withLock(() => {
    const ss = getSpreadsheet();
    let sheet = ss.getSheetByName('Savings_Updates');
    if (!sheet) {
      sheet = ss.insertSheet('Savings_Updates');
      sheet.appendRow(['Updated_At', 'Current_Savings', 'Note']);
    }
    sheet.appendRow([dateStr, amount, note || '']);
    return getState();
  });
}
