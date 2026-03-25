// index_guard.gs
// GracePulse PWA Backend - IndexGuard Calculation Module

function calculateIndexDelta(targetMonthDate) {
  const ss = getSpreadsheet();
  const milestonesData = _readSheet(ss, 'Milestones');
  const indexData = _readSheet(ss, 'Construction_Index');
  const settingsData = _readSheet(ss, 'System_Settings');

  // Convert settings to Map
  const settings = {};
  settingsData.forEach(row => {
    if (row.Key) settings[row.Key] = row.Value;
  });

  const baseIndex = parseFloat(settings['Base_Construction_Index']) || 0;
  const totalContractAmount = parseFloat(settings['Total_Contract_Amount']) || 1635000;

  if (baseIndex === 0) throw new Error("Base_Construction_Index is missing or zero.");

  // Get Applicable Current Index
  let currentIndex = 0;
  indexData.forEach(idxRow => {
    let iDate = _parseDate(idxRow.Effective_Month || idxRow.Date);
    if (iDate <= targetMonthDate) {
      currentIndex = parseFloat(idxRow.Index_Value || idxRow.Value);
    }
  });

  if (currentIndex === 0) throw new Error("No applicable Construction Index found for date: " + targetMonthDate);

  // Get Total Drawn Principal Only (Excluding Linkage Charges)
  let totalDrawnPrincipalOnly = 0;
  milestonesData.forEach(m => {
    let mDate = _parseDate(m.Date);
    if (mDate <= targetMonthDate) {
      if (String(m.Track) !== 'Index_Linkage_Charge') {
        totalDrawnPrincipalOnly += parseFloat(m.Amount) || 0;
      }
    }
  });

  // Calculate Undrawn Balance
  const undrawnBalance = totalContractAmount - totalDrawnPrincipalOnly;
  if (undrawnBalance <= 0) return 0; // Fully drawn

  // Calculate Linkage Cost Formula
  const linkageCost = undrawnBalance * ((currentIndex / baseIndex) - 1);

  // Prevent negative linkage
  return Math.max(0, linkageCost);
}
