// js/index_guard.js

// Global state for IndexGuard
let currentIgMonth = null;
let currentIgLegalCharge = 0;
let currentIgContractorCharge = 0;
let currentIgDelta = 0;
let currentIgIndex = 0;

window.openIndexGuardSheet = function(monthStr) {
  currentIgMonth = monthStr;
  currentIgLegalCharge = 0;
  currentIgContractorCharge = 0;
  currentIgDelta = 0;
  currentIgIndex = 0;

  // Clear input and reset display
  document.getElementById('ig-current-index').value = '';
  document.getElementById('ig-legal-charge').textContent = '0 ₪';
  document.getElementById('ig-contractor-charge').textContent = '0 ₪';
  document.getElementById('ig-delta-display').textContent = '0 ₪';
  document.getElementById('ig-delta-display').className = '';
  document.getElementById('btn-ig-approve').disabled = true;

  document.getElementById('index-guard-overlay').classList.remove('hidden');
  document.getElementById('index-guard-sheet').classList.remove('hidden');
};

window.closeIndexGuardSheet = function() {
  document.getElementById('index-guard-overlay').classList.add('hidden');
  document.getElementById('index-guard-sheet').classList.add('hidden');
  currentIgMonth = null;
};

window.calculateIndexGuardDelta = function() {
  const currentIndexInput = document.getElementById('ig-current-index').value;
  const currentIndex = parseFloat(currentIndexInput);

  if (isNaN(currentIndex) || currentIndex <= 0) {
    document.getElementById('ig-legal-charge').textContent = '0 ₪';
    document.getElementById('ig-contractor-charge').textContent = '0 ₪';
    document.getElementById('ig-delta-display').textContent = '0 ₪';
    document.getElementById('btn-ig-approve').disabled = true;
    return;
  }

  if (!window.appState || !window.appState.settings) {
    window.showToast('שגיאה בטעינת נתוני מערכת', 'error');
    return;
  }

  // Extract 4 settings from appState.settings
  const baseConstructionIndex = parseFloat(window.appState.settings['Base_Construction_Index']);
  const legalLinkageRate = parseFloat(window.appState.settings['Legal_Linkage_Rate']) || 1.0;
  const contractorBaseIndex = parseFloat(window.appState.settings['Contractor_Base_Index']);
  const contractorLinkageRate = parseFloat(window.appState.settings['Contractor_Linkage_Rate']) || 1.0;
  const totalContract = parseFloat(window.appState.settings['Total_Contract_Amount']);

  if (isNaN(baseConstructionIndex) || isNaN(contractorBaseIndex) || isNaN(totalContract)) {
    window.showToast('נתוני בסיס חסרים', 'error');
    return;
  }

  // Calculate Undrawn Balance
  let totalDrawnPrincipalOnly = 0;
  const today = new Date(currentIgMonth + '-01');

  if (window.appState.milestones) {
    window.appState.milestones.forEach(m => {
      let mDate = new Date(m.Date);
      if (mDate <= today && String(m.Track) !== 'Index_Linkage_Charge') {
        totalDrawnPrincipalOnly += parseFloat(m.Amount) || 0;
      }
    });
  }

  const undrawnBalance = totalContract - totalDrawnPrincipalOnly;

  // Calculate Legal Charge
  if (undrawnBalance <= 0) {
    currentIgLegalCharge = 0;
    currentIgContractorCharge = 0;
  } else {
    // Legal_Charge = Undrawn_Balance * ((Current_Index / Base_Construction_Index) - 1) * Legal_Linkage_Rate
    currentIgLegalCharge = undrawnBalance * ((currentIndex / baseConstructionIndex) - 1) * legalLinkageRate;
    currentIgLegalCharge = Math.max(0, currentIgLegalCharge);

    // Contractor_Charge = Undrawn_Balance * ((Current_Index / Contractor_Base_Index) - 1) * Contractor_Linkage_Rate
    currentIgContractorCharge = undrawnBalance * ((currentIndex / contractorBaseIndex) - 1) * contractorLinkageRate;
    currentIgContractorCharge = Math.max(0, currentIgContractorCharge);
  }

  // Calculate Delta = Contractor_Charge - Legal_Charge
  currentIgDelta = currentIgContractorCharge - currentIgLegalCharge;
  currentIgIndex = currentIndex;

  // Update UI
  document.getElementById('ig-legal-charge').textContent = window.formatILS(currentIgLegalCharge);
  document.getElementById('ig-contractor-charge').textContent = window.formatILS(currentIgContractorCharge);
  
  const deltaDisplay = document.getElementById('ig-delta-display');
  deltaDisplay.textContent = window.formatILS(Math.abs(currentIgDelta));
  
  // Color coding: Red if Delta > 0 (Contractor overcharging), Green if Delta <= 0
  deltaDisplay.className = currentIgDelta > 0 ? 'ig-delta-positive' : 'ig-delta-negative';
  
  // Enable approve button only if there's a positive delta (contractor overcharging)
  document.getElementById('btn-ig-approve').disabled = currentIgDelta <= 0;
};

window.approveIndexLinkage = async function() {
  if (currentIgDelta <= 0) {
    window.showToast('אין הפרש חיובי לאישור', 'error');
    return;
  }

  if (!confirm(`האם לאשר הפרש הצמדה של ${window.formatILS(currentIgDelta)}?`)) return;

  window.showLoading(true);
  try {
    const payload = {
      action: "approveIndexLinkage",
      indexData: {
        current_index: currentIgIndex,
        legal_charge: currentIgLegalCharge,
        contractor_charge: currentIgContractorCharge,
        delta_amount: currentIgDelta,
        month: currentIgMonth
      },
      // Keep backwards compatibility with the backend
      date: currentIgMonth + "-01",
      amount: currentIgDelta
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      }
    });

    if (!response.ok) throw new Error("Network request failed");

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    window.appState = data;
    window.renderApp();
    window.showToast("הפרש ההצמדה נשמר בהצלחה");
    window.closeIndexGuardSheet();
  } catch (error) {
    console.error("Linkage approval failed:", error);
    window.showToast(`שגיאה בשמירת נתוני הצמדה: ${error.message}`, "error");
  } finally {
    window.showLoading(false);
  }
};