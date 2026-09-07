// js/app.js

// Configuration
const API_URL = "https://script.google.com/macros/s/AKfycbx71ZFrhtTGy66h5x6fRE6wqi-xOxNz9i6dswyrU4zf6XV410zaMd1ZeqJQ7UEZDPlJTA/exec";

// Constants for totals
const TRACK_TOTALS = {
  Mishtana: 327000,
  Kavua: 654000,
  Prime: 654000
};

// Global State
window.appState = null;
window.showAllClosedMonths = false;

// Utility: Format Currency
window.formatILS = (num) => {
  const val = parseFloat(num) || 0;
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(val);
};

// Utility: Parse boolean from string/bool
window.isTrue = (val) => val === true || String(val).toUpperCase() === 'TRUE';
window.escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

// UI Utilities
window.showLoading = (show) => {
  document.getElementById('loading-overlay').classList.toggle('hidden', !show);
};

window.showToast = (message, type = 'success') => {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `show ${type}`;
  setTimeout(() => { toast.className = toast.className.replace('show', '').trim(); }, 3000);
};

window.openPrimeRateSheet = function() {
  const current = document.getElementById('current-prime').textContent;
  document.getElementById('prime-rate-input').value = current === '--' ? '' : current;
  document.getElementById('prime-effective-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('prime-rate-overlay').classList.remove('hidden');
  document.getElementById('prime-rate-sheet').classList.remove('hidden');
  document.getElementById('prime-rate-input').focus();
};

window.closePrimeRateSheet = function() {
  document.getElementById('prime-rate-overlay').classList.add('hidden');
  document.getElementById('prime-rate-sheet').classList.add('hidden');
};

window.savePrimeRate = async function(event) {
  event.preventDefault();
  const rate = Number(document.getElementById('prime-rate-input').value);
  const date = document.getElementById('prime-effective-date').value;
  if (!Number.isFinite(rate) || rate < 0 || rate > 30 || !date) {
    showToast('יש להזין ריבית ותאריך תקינים', 'error');
    return;
  }
  if (!confirm(`לשמור ריבית פריים של ${rate}% החל מ-${date}?`)) return;
  showLoading(true);
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'addPrimeRate', date, rate }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    if (!response.ok) throw new Error('Network request failed');
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    window.appState = data;
    renderApp();
    closePrimeRateSheet();
    showToast('הריבית נשמרה והתחזית עודכנה');
  } catch (error) {
    console.error('Prime rate update failed:', error);
    showToast(`שגיאה בעדכון הריבית: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
};

window.openConstructionIndexSheet = function() {
  const indexDisplay = document.getElementById('current-index');
  const current = indexDisplay.dataset.rawValue || indexDisplay.textContent;
  document.getElementById('construction-index-input').value = current === '--' ? '' : current;
  document.getElementById('construction-index-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('construction-index-overlay').classList.remove('hidden');
  document.getElementById('construction-index-sheet').classList.remove('hidden');
  document.getElementById('construction-index-input').focus();
};

window.closeConstructionIndexSheet = function() {
  document.getElementById('construction-index-overlay').classList.add('hidden');
  document.getElementById('construction-index-sheet').classList.add('hidden');
};

window.saveConstructionIndex = async function(event) {
  event.preventDefault();
  const indexValue = Number(document.getElementById('construction-index-input').value);
  const date = document.getElementById('construction-index-date').value;
  if (!Number.isFinite(indexValue) || indexValue <= 0 || !date) {
    showToast('יש להזין מדד ותאריך תקינים', 'error');
    return;
  }
  showLoading(true);
  try {
    const response = await fetch(API_URL, {
      method: 'POST', body: JSON.stringify({ action: 'addConstructionIndex', date, indexValue }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    if (!response.ok) throw new Error('Network request failed');
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    window.appState = data;
    renderApp();
    closeConstructionIndexSheet();
    showToast('המדד נשמר והצפי עודכן');
  } catch (error) {
    console.error('Construction index update failed:', error);
    showToast(`שגיאה בעדכון המדד: ${error.message}`, 'error');
  } finally { showLoading(false); }
};

window.toggleClosedMonths = function() {
  window.showAllClosedMonths = !window.showAllClosedMonths;
  renderApp();
};

window.openSavingsSheet = function() {
  document.getElementById('dedicated-savings-input').value = '';
  document.getElementById('savings-note').value = '';
  document.getElementById('savings-overlay').classList.remove('hidden');
  document.getElementById('savings-sheet').classList.remove('hidden');
  document.getElementById('dedicated-savings-input').focus();
};

window.closeSavingsSheet = function() {
  document.getElementById('savings-overlay').classList.add('hidden');
  document.getElementById('savings-sheet').classList.add('hidden');
};

window.saveDedicatedSavings = async function(event) {
  event.preventDefault();
  const amount = Number(document.getElementById('dedicated-savings-input').value);
  const note = document.getElementById('savings-note').value.trim();
  if (!Number.isFinite(amount) || amount < 0) {
    showToast('יש להזין סכום חיסכון תקין', 'error');
    return;
  }
  showLoading(true);
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'updateDedicatedSavings', date: new Date().toISOString(), amount, note }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    if (!response.ok) throw new Error('Network request failed');
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    window.appState = data;
    renderApp();
    closeSavingsSheet();
    showToast('החיסכון הייעודי עודכן');
  } catch (error) {
    console.error('Savings update failed:', error);
    showToast(`שגיאה בעדכון החיסכון: ${error.message}`, 'error');
  } finally {
    showLoading(false);
  }
};

// Initialize App
async function initApp() {
  try {
    await fetchState();
  } catch (error) {
    console.error("Initialization failed:", error);
    showToast("שגיאה בטעינת הנתונים", "error");
    showLoading(false);
  }
}

// API: Fetch State
window.fetchState = async function() {
  showLoading(true);
  try {
    const response = await fetch(`${API_URL}?action=getState`, {
      method: 'GET',
    });

    if (!response.ok) throw new Error("Network response was not ok");

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    window.appState = data;
    renderApp();
  } catch (error) {
    throw error;
  } finally {
    showLoading(false);
  }
}

// API: Lock Month
window.lockMonth = async function(monthStr, btnElement) {
  if(!confirm(`האם אתה בטוח שברצונך לנעול ולשמור את הנתונים עבור חודש ${monthStr}? פעולה זו אינה הפיכה.`)) return;

  showLoading(true);
  try {
    const payload = { action: "lockMonth", month: monthStr };

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
    renderApp();
    showToast("החודש אושר וננעל בהצלחה");
    showLoading(false);

  } catch (error) {
    console.error("Locking failed:", error);
    showToast(`שגיאה באישור החודש: ${error.message}`, "error");
    showLoading(false);
  }
}

// API: Update Inflows
window.updateInflows = async function(monthStr, index) {
  const romInput = document.getElementById(`input-rom-${index}`);
  const yaelInput = document.getElementById(`input-yael-${index}`);
  const depInput = document.getElementById(`input-dep-${index}`);

  const romVal = parseFloat(romInput.value) || 0;
  const yaelVal = parseFloat(yaelInput.value) || 0;
  const depVal = parseFloat(depInput.value) || 0;

  showLoading(true);
  try {
    const payload = {
      action: "updateInflows",
      month: monthStr,
      rom: romVal,
      yael: yaelVal,
      deposit: depVal
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
    renderApp();
    showToast("הנתונים נשמרו בהצלחה");
  } catch (error) {
    console.error("Update failed:", error);
    showToast(`שגיאה בשמירת הנתונים: ${error.message}`, "error");
  } finally {
    showLoading(false);
  }
}

// Calculate Active Drawn per Track locally based on milestones up to "today"
window.calculateActiveDrawnForBars = function() {
  let drawn = { Mishtana: 0, Kavua: 0, Prime: 0 };

  if (!window.appState || !window.appState.milestones) return drawn;

  window.appState.milestones.forEach(m => {
    if (isTrue(m.Is_Drawn)) {
      let track = String(m.Track).toLowerCase();
      let amount = parseFloat(m.Amount) || 0;
      if (track.includes('mishtana')) drawn.Mishtana += amount;
      else if (track.includes('kavua')) drawn.Kavua += amount;
      else if (track.includes('prime')) drawn.Prime += amount;
    }
  });
  return drawn;
}

// Render App
window.renderApp = function() {
  if (!window.appState) return;

  const state = window.appState;

  // 1. Dashboard Aggregates
      document.getElementById('liquid-balance').textContent = formatILS(appState.aggregates.liquidBalance);
      const remainingGraceFromLedger = (state.ledger || []).reduce((sum, row) => {
        return isTrue(row.Is_Locked) ? sum : sum + (parseFloat(row.Grace_Deduction) || 0);
      }, 0);
      const remainingGrace = Number.isFinite(Number(appState.aggregates.totalRemainingGrace))
        ? Number(appState.aggregates.totalRemainingGrace)
        : remainingGraceFromLedger;
      document.getElementById('remaining-bank').textContent = formatILS(remainingGrace);

      const kitchenTotal = Number(state.settings.Kitchen_Total) || 27800;
      const kitchenPaid = Number(state.settings.Kitchen_Paid) || 6850;
      const appliancesTotal = Number(state.settings.Appliances_Total) || 11392;
      const appliancesPaid = Number(state.settings.Appliances_Paid) || 2848;
      const aviviRemaining = Math.max(0, kitchenTotal - kitchenPaid) + Math.max(0, appliancesTotal - appliancesPaid);
      const savingsFromRows = (state.savingsUpdates || []).reduce((sum, row) => sum + (Number(row.Current_Savings) || 0), 0);
      const dedicatedSavings = Number.isFinite(Number(state.aggregates.dedicatedSavings))
        ? Number(state.aggregates.dedicatedSavings)
        : savingsFromRows;
      const savingsGap = aviviRemaining - dedicatedSavings;
      document.getElementById('avivi-remaining').textContent = formatILS(aviviRemaining);
      document.getElementById('dedicated-savings').textContent = formatILS(dedicatedSavings);
      document.getElementById('savings-gap-label').textContent = savingsGap >= 0 ? 'חסר ליעד' : 'עודף מול היעד';
      document.getElementById('savings-gap').textContent = formatILS(Math.abs(savingsGap));
      document.getElementById('savings-gap').className = savingsGap > 0 ? 'text-danger' : 'text-success';
      document.getElementById('savings-progress').style.width = `${Math.min(100, aviviRemaining ? (dedicatedSavings / aviviRemaining) * 100 : 100)}%`;
      document.getElementById('avivi-breakdown').textContent = `מטבח: ${formatILS(kitchenTotal - kitchenPaid)} נותרו · מכשירי חשמל: ${formatILS(appliancesTotal - appliancesPaid)} נותרו`;

      const baseIndex = Number(state.settings.Base_Construction_Index) || 137.7;
      const linkageRate = Number(state.settings.Legal_Linkage_Rate) || 0.4;
      const indexFromRows = (state.constructionIndices || []).reduce((latest, row) => {
        const values = Object.values(row);
        const value = Number(row.Index_Value ?? row.Value ?? values[1]);
        return Number.isFinite(value) && value > 0 ? value : latest;
      }, 0);
      const currentIndex = Number(state.aggregates.currentIndexValue) || indexFromRows || 147.5545;
      const paidIndex = Number(state.aggregates.indexLinkagePaid) || (state.indexLinkage || []).reduce((sum, row) => isTrue(row.Is_Paid) ? sum + (Number(row.Amount) || 0) : sum, 0);
      const linkageMilestoneKeys = new Set((state.indexLinkage || []).map(row => `${new Date(row.Date).getTime()}|${Number(row.Amount) || 0}|${String(row.Related_Track || '').toLowerCase()}`));
      const remainingPrincipal = (state.milestones || []).reduce((sum, row) => {
        const key = `${new Date(row.Date).getTime()}|${Number(row.Amount) || 0}|${String(row.Track || '').toLowerCase()}`;
        return isTrue(row.Is_Drawn) || linkageMilestoneKeys.has(key) ? sum : sum + (Number(row.Amount) || 0);
      }, 0);
      const expectedIndex = Number(state.aggregates.indexLinkageRemaining) || Math.max(0, remainingPrincipal * linkageRate * ((currentIndex / baseIndex) - 1));
      const totalIndex = paidIndex + expectedIndex;
      document.getElementById('current-index').textContent = currentIndex.toFixed(2);
      document.getElementById('current-index').dataset.rawValue = String(currentIndex);
      document.getElementById('base-index').textContent = baseIndex;
      document.getElementById('index-total').textContent = formatILS(totalIndex);
      document.getElementById('index-breakdown').textContent = `כולל ${formatILS(paidIndex)} שכבר שולמו ועוד ${formatILS(expectedIndex)} הצמדה צפויה לפי מדד ${currentIndex.toFixed(2)}.`;
      
      // --- STRICT DB REFLECTION: Prime Rate ---
      const aggregatePrime = Number(appState.aggregates.currentPrimeRate);
      const primeFromRows = (appState.primeRates || []).reduce((latest, row) => {
        const values = Object.values(row);
        const rate = Number(row.Prime_Rate ?? row.Prime_Rate_Value ?? row.Rate ?? values[1]);
        const date = new Date(row.Effective_Date ?? row.Date ?? values[0]);
        return Number.isFinite(rate) && (!latest || isNaN(date) || date <= new Date()) ? rate : latest;
      }, 0);
      const currentPrime = aggregatePrime > 0 ? aggregatePrime : primeFromRows;
      const displayPrime = currentPrime > 0 ? currentPrime.toFixed(2).replace(/\.00$/, '') : '--';
      document.getElementById('current-prime').textContent = displayPrime;

      // --- Projected Final Balance (Text Color Only) ---
      const projectedFinalEl = document.getElementById('projected-final');
      if (appState.ledger && appState.ledger.length > 0) {
        const lastRow = appState.ledger[appState.ledger.length - 1];
        const finalBalance = parseFloat(lastRow.End_Balance) || 0;
        const overallBalance = finalBalance - savingsGap - totalIndex;
        const overallEl = document.getElementById('overall-balance');
        overallEl.textContent = formatILS(overallBalance);
        overallEl.className = overallBalance < 0 ? 'text-danger' : 'text-success';

        if (finalBalance < 0) {
          projectedFinalEl.className = 'text-danger';
          projectedFinalEl.textContent = formatILS(finalBalance);
        } else if (finalBalance > 0) {
          projectedFinalEl.className = 'text-success';
          projectedFinalEl.textContent = formatILS(finalBalance);
        } else {
          projectedFinalEl.className = '';
          projectedFinalEl.textContent = formatILS(finalBalance);
        }
      }

  // 2. Tracks Progress
  const drawn = calculateActiveDrawnForBars();
  const tracksContainer = document.getElementById('tracks-container');

  const tracksMeta = [
    { key: 'Mishtana', name: 'משתנה כל 5', current: drawn.Mishtana, total: TRACK_TOTALS.Mishtana, class: 'mishtana' },
    { key: 'Kavua', name: 'קבועה לא צמודה', current: drawn.Kavua, total: TRACK_TOTALS.Kavua, class: 'kavua' },
    { key: 'Prime', name: 'פריים', current: drawn.Prime, total: TRACK_TOTALS.Prime, class: 'prime' }
  ];

  tracksContainer.innerHTML = tracksMeta.map(t => {
    const pct = Math.min(100, Math.round((t.current / t.total) * 100)) || 0;
    return `
      <div class="track-item">
        <div class="track-header">
          <span class="track-name">${t.name}</span>
          <span class="track-amounts">${formatILS(t.current)} / ${formatILS(t.total)} (${pct}%)</span>
        </div>
        <div class="progress-bg">
          <div class="progress-fill ${t.class}" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');

  // 3. Ledger Accordion
  const ledgerContainer = document.getElementById('ledger-container');

  // Determine the active unlocked month (first row where Is_Locked is false)
  let activeMonthIndex = -1;
  for (let i = 0; i < state.ledger.length; i++) {
    if (!isTrue(state.ledger[i].Is_Locked)) {
      activeMonthIndex = i;
      break;
    }
  }

  const lastLockedIndex = state.ledger.reduce((last, row, index) => isTrue(row.Is_Locked) ? index : last, -1);
  const visibleLedger = state.ledger.map((row, index) => ({ row, index })).filter(({ row, index }) => {
    return !isTrue(row.Is_Locked) || window.showAllClosedMonths || index === lastLockedIndex;
  });
  const historyButton = document.getElementById('toggle-history');
  historyButton.innerHTML = window.showAllClosedMonths
    ? '<i class="fa-solid fa-eye-slash"></i> הסתרת חודשים סגורים'
    : '<i class="fa-solid fa-clock-rotate-left"></i> הצגת חודשים סגורים';

  ledgerContainer.innerHTML = visibleLedger.map(({ row, index }) => {
    const locked = isTrue(row.Is_Locked);
    const isActive = index === activeMonthIndex;

    // Format Month
    let displayMonth = escapeHtml(row.Month);
    try {
      const d = new Date(row.Month);
      if(!isNaN(d.getTime())) {
        displayMonth = d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
      }
    } catch(e) {}

    const getValHtml = (actual, planned, type, lockedFlag, idx) => {
      const hasActual = actual !== "" && actual !== null && actual !== undefined;
      const actNum = parseFloat(actual) || 0;
      const planNum = parseFloat(planned) || 0;

      if (lockedFlag) {
        if (hasActual) return `<span class="val-actual">${formatILS(actNum)}</span>`;
        if (planNum > 0) return `<span class="val-planned">${formatILS(planNum)} (צפי)</span>`;
        return `<span class="val-actual">0 ₪</span>`;
      } else {
        const val = hasActual ? actNum : planNum;
        return `<input type="number" id="input-${type}-${idx}" class="input-edit" value="${val}" min="0" step="0.01" inputmode="decimal">`;
      }
    };

    const firstDefined = (a, b) => a !== undefined ? a : b;
    const romHtml = getValHtml(firstDefined(row.Rom_Actual, row.Actual_Rom), firstDefined(row.Rom_Planned, row.Planned_Rom), 'rom', locked, index);
    const yaelHtml = getValHtml(firstDefined(row.Yael_Actual, row.Actual_Yael), firstDefined(row.Yael_Planned, row.Planned_Yael), 'yael', locked, index);
    const depHtml = getValHtml(firstDefined(row.Deposit_Actual, row.Actual_Deposit), firstDefined(row.Deposit_Planned, row.Planned_Deposit), 'dep', locked, index);

    const graceDed = parseFloat(row.Grace_Deduction) || 0;
    const endBal = parseFloat(row.End_Balance) || 0;

    return `
      <div class="ledger-card ${locked ? 'locked' : ''} ${isActive ? 'active open' : ''}" data-index="${index}">
        <div class="card-header" onclick="toggleCard(this)">
          <div class="month-info">
            <span class="month-name">${displayMonth}</span>
            <span class="status-pill">${locked ? 'נסגר' : (isActive ? 'החודש הבא' : 'מתוכנן')}</span>
          </div>
          <div class="balance-wrap">
            <div class="balance-info">
              <div class="balance-label">יתרת סגירה</div>
              <div class="balance-val">${formatILS(endBal)}</div>
            </div>
            <i class="fa-solid fa-chevron-down expand-icon"></i>
          </div>
        </div>
        <div class="card-body">
          <div class="details-grid"><div class="detail-row">
            <span class="detail-label">הכנסה - רום:</span>
            <span class="detail-val">${romHtml}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">הכנסה - יעל:</span>
            <span class="detail-val">${yaelHtml}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">הפקדה (אחר):</span>
            <span class="detail-val">${depHtml}</span>
          </div>
          <div class="detail-row grace-row">
            <span class="detail-label">תשלום גרייס ${locked ? 'ששולם' : 'צפוי'}:</span>
            <span class="detail-val">- ${formatILS(graceDed)}</span>
          </div></div>

          ${!locked ? `
            <div class="action-row">
              <button class="btn-save" onclick="updateInflows('${escapeHtml(row.Month)}', ${index})">
                <i class="fa-solid fa-floppy-disk"></i> שמור שינויים
              </button>
              ${isActive ? `
              <button class="btn-approve" onclick="lockMonth('${escapeHtml(row.Month)}', this)">
                <i class="fa-solid fa-check-circle"></i> אשר וסגור חודש
              </button>
              ` : ''}
              <button class="btn-ig-calc" onclick="window.openIndexGuardSheet('${escapeHtml(row.Month)}')">
                <i class="fa-solid fa-scale-balanced"></i> בדיקת הצמדה
              </button>
            </div>
          ` : `
            <div class="locked-note">
              <i class="fa-solid fa-shield-halved"></i> חודש נעול (קריאה בלבד)
            </div>
          `}
        </div>
      </div>
    `;
  }).join('');
}

// UI: Toggle Accordion Card
window.toggleCard = function(headerElement) {
  const card = headerElement.closest('.ledger-card');
  card.classList.toggle('open');
};

// Boot
document.addEventListener("DOMContentLoaded", initApp);
