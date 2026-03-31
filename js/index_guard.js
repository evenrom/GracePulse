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

  // Auto-detect principal for the selected month from Milestones
  let defaultPrincipal = '';
  if (window.appState && window.appState.milestones) {
    const [year, month] = monthStr.split('-');
    const milestone = window.appState.milestones.find(m => {
      if (!m.Date || String(m.Track) === 'Index_Linkage_Charge') return false;
      const d = new Date(m.Date);
      return d.getFullYear() === parseInt(year) && (d.getMonth() + 1) === parseInt(month);
    });
    if (milestone) defaultPrincipal = milestone.Amount;
  }

  // Reset inputs and display
  document.getElementById('ig-principal-amount').value = defaultPrincipal;
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
  const principalInput = document.getElementById('ig-principal-amount').value;
  
  const currentIndex = parseFloat(currentIndexInput);
  const principal = parseFloat(principalInput);

  if (isNaN(currentIndex) || currentIndex <= 0 || isNaN(principal) || principal <= 0) {
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

  // Extract settings from appState.settings
  const baseConstructionIndex = parseFloat(window.appState.settings['Base_Construction_Index']);
  const legalLinkageRate = parseFloat(window.appState.settings['Legal_Linkage_Rate']) || 1.0;
  const contractorBaseIndex = parseFloat(window.appState.settings['Contractor_Base_Index']);
  const contractorLinkageRate = parseFloat(window.appState.settings['Contractor_Linkage_Rate']) || 1.0;

  if (isNaN(baseConstructionIndex) || isNaN(contractorBaseIndex)) {
    window.showToast('נתוני בסיס חסרים', 'error');
    return;
  }

  // Legal_Charge = Principal * ((Current_Index / Base_Construction_Index) - 1) * Legal_Linkage_Rate
  currentIgLegalCharge = principal * ((currentIndex / baseConstructionIndex) - 1) * legalLinkageRate;
  currentIgLegalCharge = Math.max(0, currentIgLegalCharge);

  // Contractor_Charge = Principal * ((Current_Index / Contractor_Base_Index) - 1) * Contractor_Linkage_Rate
  currentIgContractorCharge = principal * ((currentIndex / contractorBaseIndex) - 1) * contractorLinkageRate;
  currentIgContractorCharge = Math.max(0, currentIgContractorCharge);

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
  
  // FIX: Enable approve button as long as there is a valid contractor charge to add to the mortgage!
  document.getElementById('btn-ig-approve').disabled = currentIgContractorCharge <= 0;
};

window.approveIndexLinkage = async function() {
  // FIX: We check if there's an actual charge, not just a positive delta
  if (currentIgContractorCharge <= 0) {
    window.showToast('אין סכום הצמדה חיובי לאישור', 'error');
    return;
  }

  // FIX: Prompt the user with the actual amount being added to the mortgage
  if (!confirm(`האם לאשר ולהוסיף חוב הצמדה בסך ${window.formatILS(currentIgContractorCharge)} למשכנתא שלך?`)) return;

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
      date: currentIgMonth + "-01",
      // CRITICAL FIX: Sending the Contractor Charge to the DB, not the Delta!
      amount: currentIgContractorCharge 
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
