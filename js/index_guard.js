// js/index_guard.js

// Global state for IndexGuard
let currentIgMonth = null;
let currentIgDelta = 0;
let currentIgIndex = 0;

window.openIndexGuardSheet = function(monthStr) {
  currentIgMonth = monthStr;
  currentIgDelta = 0;
  currentIgIndex = 0;

  // Clear inputs
  document.getElementById('ig-current-index').value = '';
  document.getElementById('ig-result-display').textContent = '0 ₪';
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
    window.showToast('נא להזין מדד תקין', 'error');
    return;
  }

  if (!window.appState || !window.appState.settings) {
    window.showToast('שגיאה בטעינת נתוני מערכת', 'error');
    return;
  }

  const baseIndex = parseFloat(window.appState.settings['Base_Construction_Index']);
  const totalContract = parseFloat(window.appState.settings['Total_Contract_Amount']);

  if (isNaN(baseIndex) || isNaN(totalContract)) {
    window.showToast('נתוני בסיס חסרים (מדד התחלתי או סך חוזה)', 'error');
    return;
  }

  // Calculate Undrawn Principal Only
  let totalDrawnPrincipalOnly = 0;
  const today = new Date(currentIgMonth + '-01'); // Using the targeted month for context

  if (window.appState.milestones) {
    window.appState.milestones.forEach(m => {
      let mDate = new Date(m.Date);
      if (mDate <= today && String(m.Track) !== 'Index_Linkage_Charge') {
        totalDrawnPrincipalOnly += parseFloat(m.Amount) || 0;
      }
    });
  }

  const undrawnBalance = totalContract - totalDrawnPrincipalOnly;

  if (undrawnBalance <= 0) {
    currentIgDelta = 0;
  } else {
    // Formula: Undrawn_Balance * ((Current_Index / Base_Index) - 1)
    currentIgDelta = undrawnBalance * ((currentIndex / baseIndex) - 1);
    currentIgDelta = Math.max(0, currentIgDelta); // Prevent negative linkage
  }

  currentIgIndex = currentIndex;

  document.getElementById('ig-result-display').textContent = window.formatILS(currentIgDelta);
  document.getElementById('btn-ig-approve').disabled = false;
};

window.approveIndexLinkage = async function() {
  if (currentIgDelta <= 0) {
    window.showToast('אין תוספת הצמדה לאישור', 'error');
    return;
  }

  if(!confirm(`האם לאשר תוספת הצמדה למדד בסך ${window.formatILS(currentIgDelta)}?`)) return;

  window.showLoading(true);
  try {
    const payload = {
      action: "approveIndexLinkage",
      indexData: {
        current_index: currentIgIndex,
        delta_amount: currentIgDelta,
        month: currentIgMonth
      },
      // Keep backwards compatibility with the backend expecting flat parameters:
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
    window.showToast("תוספת ההצמדה נשמרה בהצלחה");
    window.closeIndexGuardSheet();
  } catch (error) {
    console.error("Linkage approval failed:", error);
    window.showToast(`שגיאה בשמירת נתוני הצמדה: ${error.message}`, "error");
  } finally {
    window.showLoading(false);
  }
};
