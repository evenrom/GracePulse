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
  const today = new Date();

  if (!window.appState || !window.appState.milestones) return drawn;

  window.appState.milestones.forEach(m => {
    let mDate = new Date(m.Date);
    if (mDate <= today) {
      let track = String(m.Track).toLowerCase();
      let amount = parseFloat(m.Amount) || 0;
      if (track.includes('mishtana')) drawn.Mishtana += amount;
      else if (track.includes('kavua')) drawn.Kavua += amount;
      else if (track.includes('prime')) drawn.Prime += amount;
      // Index linkage charge is dynamically added to the Kavua principal
      else if (track.includes('index_linkage_charge')) drawn.Mishtana += amount;
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
      document.getElementById('remaining-contractor').textContent = formatILS(appState.aggregates.totalRemainingToContractor);
      
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

  ledgerContainer.innerHTML = state.ledger.map((row, index) => {
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
