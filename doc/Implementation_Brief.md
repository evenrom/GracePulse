# GracePulse - Developer Implementation Brief

## 1. Tech Stack Overview
- **Frontend:** Vanilla HTML5, CSS3, ES6 JavaScript. No frameworks (React/Vue) to ensure lightweight PWA execution.
- **Backend:** Google Apps Script (GAS) functioning as a serverless REST API (`doGet`, `doPost`).
- **Database:** Google Sheets.

## 2. Component Architecture
### Frontend
- `app.js`: Central controller. Manages DOM rendering, state (`window.appState`), API fetch calls, and UI interactions (accordions, toasts).
- `index_guard.js`: Encapsulated module for the linkage audit math and bottom-sheet UI management.
- `style.css`: Contains all CSS variables, resets, and glassmorphism styling.

### Backend (GAS)
- `api.gs`: HTTP Request router. Handles preflight CORS and sanitizes payloads.
- `db_controllers.gs`: Manages read/write operations to Sheets. Implements `LockService` to prevent write-race conditions. Forces `recalculateGrace` on state fetch to sync manual DB edits.
- `grace_engine.gs`: The core math engine. Loops through the ledger, applies smart date parsing, pulls active drawn funds and historical prime rates, and calculates Grace deductions.

## 3. Database Schema (Google Sheets)
- **`Monthly_Ledger`**: `Month` (Date), `Rom_Planned`, `Yael_Planned`, `Deposit_Planned`, `Rom_Actual`, `Yael_Actual`, `Deposit_Actual`, `Grace_Deduction`, `End_Balance`, `Is_Locked` (Boolean).
- **`Milestones`**: `Date`, `Amount`, `Track` (Mishtana/Kavua/Prime/Index_Linkage_Charge), `Is_Drawn` (Boolean).
- **`Prime_Rates`**: `Effective_Date`, `Prime_Rate`.
- **`System_Settings`**: `Key`, `Value` (Rows: Total_Contract_Amount, Base_Construction_Index, Legal_Linkage_Rate, Contractor_Base_Index, Contractor_Linkage_Rate).

## 4. Critical Development Guidelines
1. **Explicit Zero Handling:** The backend must respect `0` as a valid user input for Actual Income, overriding Planned Income. Code must check `val !== ""` and `val !== null`, not `val > 0`.
2. **Timezone Safety:** Use smart date parsing (`val.split('T')[0]`) in the backend to match months safely, avoiding UTC/IDT mismatch errors (e.g., matching `2026-04-30T21:00Z` to `May 2026`).
3. **Locked State Immutability:** If `Is_Locked === TRUE`, the engine MUST NOT recalculate `Grace_Deduction`. It must pull the literal DB value. However, it MUST continually recalculate `End_Balance` to propagate cash ripples forward.
4. **Index Linkage Compounding:** Entries in Milestones labeled `Index_Linkage_Charge` are treated as active drawn principal under the `Mishtana` track to accrue standard grace interest rules.