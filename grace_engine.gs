// grace_engine.gs
// GracePulse PWA Backend - Grace Calculation Engine

function recalculateGrace(ss) {
  if (!ss) ss = getSpreadsheet();

  const ledgerSheet = ss.getSheetByName('Monthly_Ledger');
  const ledgerRange = ledgerSheet.getDataRange();
  const ledgerData = ledgerRange.getValues();
  const ledgerHeaders = ledgerData[0];

  const milestonesData = _readSheet(ss, 'Milestones');
  const primeRatesData = _readSheet(ss, 'Prime_Rates');

  // Indexes
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

  // Helper: Get Active Drawn Funds
  function getActiveDrawnFunds(targetMonthDate) {
    let drawn = { Mishtana: 0, Kavua: 0, Prime: 0 };
    milestonesData.forEach(m => {
      let mDate = _parseDate(m.Date);
      if (mDate <= targetMonthDate) {
        let track = String(m.Track).toLowerCase();
        let amount = parseFloat(m.Amount) || 0;

        if (track.includes('mishtana')) drawn.Mishtana += amount;
        else if (track.includes('kavua')) drawn.Kavua += amount;
        else if (track.includes('prime')) drawn.Prime += amount;
        else if (track.includes('index_linkage_charge')) {
          // As a business rule, Index_Linkage_Charge dynamically increases the active principal.
          // We allocate it to the Kavua track to subject this penalty to a fixed 4.80% interest rate,
          // ensuring the linkage cost compounds expectedly within the Grace formula.
          drawn.Kavua += amount;
        }
      }
    });
    return drawn;
  }

  // Helper: Get Applicable Prime Rate
  function getApplicablePrimeRate(targetMonthDate) {
    let applicableRate = 0;
    primeRatesData.forEach(p => {
      let pDate = _parseDate(p.Date || p.Effective_Month);
      if (pDate <= targetMonthDate) {
         applicableRate = parseFloat(p.Rate || p.Prime_Rate_Value);
      }
    });
    return applicableRate;
  }

  // Recalculate Logic
  for (let i = 1; i < ledgerData.length; i++) {
    let row = ledgerData[i];
    let isLocked = row[idx.Is_Locked];

    // Strictly skip locked rows
    if (String(isLocked).toUpperCase() === 'TRUE' || isLocked === true) {
      continue;
    }

    let prevEndBalance = i > 1 ? (parseFloat(ledgerData[i-1][idx.End_Balance]) || 0) : 0;

    let rom = parseFloat(row[idx.Rom_Actual]) > 0 ? parseFloat(row[idx.Rom_Actual]) : (parseFloat(row[idx.Rom_Planned]) || 0);
    let yael = parseFloat(row[idx.Yael_Actual]) > 0 ? parseFloat(row[idx.Yael_Actual]) : (parseFloat(row[idx.Yael_Planned]) || 0);
    let deposit = parseFloat(row[idx.Deposit_Actual]) > 0 ? parseFloat(row[idx.Deposit_Actual]) : (parseFloat(row[idx.Deposit_Planned]) || 0);
    let totalInflow = rom + yael + deposit;

    let currentMonthDate = _parseDate(row[idx.Month]);

    // Fallback if Date is invalid
    if (isNaN(currentMonthDate.getTime())) {
      currentMonthDate = new Date(String(row[idx.Month]) + '-01');
    }

    let funds = getActiveDrawnFunds(currentMonthDate);

    let primePercent = getApplicablePrimeRate(currentMonthDate);
    let primeDec = (primePercent / 100) - 0.007;

    // Grace Logic (Legacy Constants)
    let graceDeduction = (funds.Mishtana * 0.0485 / 12) +
                         (funds.Kavua * 0.0480 / 12) +
                         (funds.Prime * primeDec / 12);

    let endBalance = prevEndBalance + totalInflow - graceDeduction;

    // Update the array in memory
    ledgerData[i][idx.Grace_Deduction] = graceDeduction;
    ledgerData[i][idx.End_Balance] = endBalance;
  }

  // Batch Write to Sheet
  ledgerRange.setValues(ledgerData);
}
