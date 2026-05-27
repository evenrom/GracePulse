// grace_engine.gs
// GracePulse PWA Backend - Grace Calculation Engine

function recalculateGrace(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();

  const ledgerSheet = ss.getSheetByName('Monthly_Ledger');
  const ledgerRange = ledgerSheet.getDataRange();
  const ledgerData = ledgerRange.getValues();
  const ledgerHeaders = ledgerData[0];

  const milestonesData = ss.getSheetByName('Milestones').getDataRange().getValues().slice(1);
  const primeRatesData = ss.getSheetByName('Prime_Rates').getDataRange().getValues().slice(1);

  const idx = {
    Month: ledgerHeaders.indexOf('Month'),
    Is_Locked: ledgerHeaders.indexOf('Is_Locked'),
    Rom_Actual: ledgerHeaders.indexOf('Rom_Actual') !== -1 ? ledgerHeaders.indexOf('Rom_Actual') : ledgerHeaders.indexOf('Actual_Rom'),
    Rom_Planned: ledgerHeaders.indexOf('Rom_Planned') !== -1 ? ledgerHeaders.indexOf('Rom_Planned') : ledgerHeaders.indexOf('Planned_Rom'),
    Yael_Actual: ledgerHeaders.indexOf('Yael_Actual') !== -1 ? ledgerHeaders.indexOf('Yael_Actual') : ledgerHeaders.indexOf('Actual_Yael'),
    Yael_Planned: ledgerHeaders.indexOf('Yael_Planned') !== -1 ? ledgerHeaders.indexOf('Yael_Planned') : ledgerHeaders.indexOf('Planned_Yael'),
    Deposit_Actual: ledgerHeaders.indexOf('Deposit_Actual') !== -1 ? ledgerHeaders.indexOf('Deposit_Actual') : ledgerHeaders.indexOf('Actual_Deposit'),
    Deposit_Planned: ledgerHeaders.indexOf('Deposit_Planned') !== -1 ? ledgerHeaders.indexOf('Deposit_Planned') : ledgerHeaders.indexOf('Planned_Deposit'),
    Grace_Deduction: ledgerHeaders.indexOf('Grace_Deduction'),
    End_Balance: ledgerHeaders.indexOf('End_Balance')
  };

  const smartParseDate = (val) => {
    if (!val) return new Date(0);
    if (val instanceof Date) return val;
    let s = String(val).split('T')[0].trim();
    let parts = s.split('/');
    if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
    let dashParts = s.split('-');
    if (dashParts.length >= 2) return new Date(dashParts[0], dashParts[1] - 1, dashParts[2] || 1);
    return new Date(val);
  };

  const getApplicablePrimeRate = (targetMonthDate) => {
    let rate = 0;
    let sortedPrimes = primeRatesData.map(p => ({ d: smartParseDate(p[0]), r: parseFloat(p[1]) }))
                                     .sort((a, b) => a.d - b.d);
    for (let p of sortedPrimes) {
      if (!isNaN(p.d) && p.d <= targetMonthDate) rate = p.r;
    }
    return rate > 0 ? rate : 5.5; 
  };

  const getActiveDrawnFunds = (targetMonthDate) => {
    let drawn = { Mishtana: 0, Kavua: 0, Prime: 0 };
    milestonesData.forEach(m => {
      let mDate = smartParseDate(m[0]);
      if (!isNaN(mDate) && mDate <= targetMonthDate) {
        let track = String(m[2]).toLowerCase();
        let amount = parseFloat(m[1]) || 0;

        if (track.includes('mishtana')) drawn.Mishtana += amount;
        else if (track.includes('kavua')) drawn.Kavua += amount;
        else if (track.includes('prime')) drawn.Prime += amount;
        else if (track.includes('index_linkage_charge')) drawn.Mishtana += amount;
      }
    });
    return drawn;
  };

  for (let i = 1; i < ledgerData.length; i++) {
    let isLockedBool = (String(ledgerData[i][idx.Is_Locked]).toUpperCase() === 'TRUE' || ledgerData[i][idx.Is_Locked] === true);

    let prevEndBalance = i > 1 ? (parseFloat(ledgerData[i - 1][idx.End_Balance]) || 0) : 0;

    let rom = parseFloat(ledgerData[i][idx.Rom_Actual]) > 0 ? parseFloat(ledgerData[i][idx.Rom_Actual]) : (parseFloat(ledgerData[i][idx.Rom_Planned]) || 0);
    let yael = parseFloat(ledgerData[i][idx.Yael_Actual]) > 0 ? parseFloat(ledgerData[i][idx.Yael_Actual]) : (parseFloat(ledgerData[i][idx.Yael_Planned]) || 0);
    let deposit = parseFloat(ledgerData[i][idx.Deposit_Actual]) > 0 ? parseFloat(ledgerData[i][idx.Deposit_Actual]) : (parseFloat(ledgerData[i][idx.Deposit_Planned]) || 0);
    
    let totalInflow = rom + yael + deposit;
    let graceDeduction = 0;

    if (isLockedBool) {
      // IF LOCKED: Trust the DB for the Grace amount, do NOT recalculate it.
      graceDeduction = parseFloat(ledgerData[i][idx.Grace_Deduction]) || 0;
    } else {
      // IF UNLOCKED: Calculate Grace dynamically
      let currentMonthDate = smartParseDate(ledgerData[i][idx.Month]);
      if (isNaN(currentMonthDate.getTime())) {
        currentMonthDate = new Date(String(ledgerData[i][idx.Month]) + '-01');
      }

      let funds = getActiveDrawnFunds(currentMonthDate);
      let primePercent = getApplicablePrimeRate(currentMonthDate);
      let primeDec = (primePercent / 100) - 0.007;

      graceDeduction = (funds.Mishtana * 0.0485 / 12) +
                       (funds.Kavua * 0.0480 / 12) +
                       (funds.Prime * primeDec / 12);

      ledgerData[i][idx.Grace_Deduction] = graceDeduction;
    }

    // CRITICAL FIX: ALWAYS recalculate End_Balance, even if locked!
    // This ensures manual DB edits to Grace ripple through to the final balance.
    let endBalance = prevEndBalance + totalInflow - graceDeduction;
    ledgerData[i][idx.End_Balance] = endBalance;
  }

  // Batch Write to Sheet
  ledgerRange.setValues(ledgerData);
}