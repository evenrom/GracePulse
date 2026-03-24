# GracePulse: Product Requirements Document (PRD) & System Architecture (with IndexGuard)

**To:** Dexter, VP R&D
**From:** Jules, Lead Full-Stack Developer
**Date:** [Current Date]

---

## 1. System Architecture Overview (Serverless GAS + PWA)

**GracePulse** is a lightweight, mobile-first Progressive Web Application (PWA) designed to manage and track a mortgage during its grace period, now featuring the **IndexGuard** module to account for the Construction Input Index (Madad Tesumot Habniya).

- **Frontend (Client):**
  - Single-file Progressive Web App (`index.html`) using HTML5, CSS3, and Vanilla JS.
  - Mobile-first, RTL layout optimized for Hebrew with Rubik and Assistant fonts.
  - Fetches state via REST API, manages UI interactions, and displays dynamic dashboards, progress bars, and monthly ledgers.
- **Backend (Serverless REST API):**
  - Google Apps Script (GAS) functioning as a serverless backend.
  - Implements `doGet(e)`, `doPost(e)`, and `doOptions(e)` for CORS preflight, returning standard JSON with correct CORS headers (`Access-Control-Allow-Origin: *`).
- **Database:**
  - Google Sheets acts as the database, ensuring high availability, manual fallback review capabilities, and historical immutability via a strict locking mechanism.

---

## 2. Detailed Database Schema

The database consists of five primary sheets, strictly emphasizing the append-only and immutable nature of principal amounts and locked historical states.

1. **Ledger (`Monthly_Ledger`):**
   - **Purpose:** Tracks monthly calculations, inflows, grace deductions, IndexGuard linkage impacts, and end balances.
   - **Key Columns:** Month, Inflows (Rom/Yael/Deposit), Grace_Deduction, Index_Delta, End_Balance, Is_Locked.
   - **Immutability:** Once a month is locked (`Is_Locked = TRUE`), its `Grace_Deduction`, `Index_Delta`, and `End_Balance` are absolutely immutable. Recalculations strictly skip these rows.

2. **Milestones (`Milestones`):**
   - **Purpose:** Read-only schedule of contractor payments.
   - **Key Columns:** Date, Amount, Track (Mishtana, Kavua, Prime), Status.
   - **Usage:** Determines active drawn funds up to a given date for Grace calculations and remaining undrawn funds for IndexGuard calculations.

3. **Prime_Rates (`Prime_Rates`):**
   - **Purpose:** Append-only historical log of Prime Rate changes.
   - **Key Columns:** Effective_Month, Prime_Rate_Value.
   - **Usage:** Dynamic calculation of Prime track interest for all future (unlocked) months based on the latest applicable rate.

4. **Construction_Index (`Construction_Index`):**
   - **Purpose:** Append-only log of the Construction Input Index values (Madad).
   - **Key Columns:** Effective_Month, Index_Value.
   - **Usage:** Core input for the IndexGuard module to calculate linkage deltas on undrawn funds.

5. **System_Settings (`System_Settings`):**
   - **Purpose:** Key-value store for global constants and system configurations.
   - **Key Rows:** Base_Construction_Index (the index value at the time of contract signing), Total_Contract_Amount, Track_Allocations.

---

## 3. API Endpoints Definition

The GAS backend exposes a single REST endpoint capable of handling GET and POST requests.

### **`GET /exec?action=getState`**
- **Description:** Fetches the complete application state.
- **Response Payload (JSON):**
  ```json
  {
    "ledger": [...],
    "milestones": [...],
    "primeRates": [...],
    "constructionIndices": [...],
    "settings": {...},
    "aggregates": {
      "liquidBalance": 12500,
      "totalRemainingToContractor": 1308000,
      "totalDrawn": 327000,
      "currentPrimeRate": 6.0,
      "currentIndexValue": 130.5
    }
  }
  ```

### **`POST /exec`**
Expects a JSON payload detailing the required action.

- **Action: `lockMonth`**
  - **Payload:** `{ "action": "lockMonth", "month": "2025-10" }`
  - **Response:** Updated full state or `{ "error": "Message" }`.

- **Action: `updateInflows`**
  - **Payload:** `{ "action": "updateInflows", "month": "2025-10", "rom": 5000, "yael": 4500, "deposit": 0 }`
  - **Response:** Updated full state.

- **Action: `addPrimeRate`**
  - **Payload:** `{ "action": "addPrimeRate", "date": "2025-11", "rate": 5.75 }`
  - **Response:** Updated full state.

- **Action: `addConstructionIndex`**
  - **Payload:** `{ "action": "addConstructionIndex", "date": "2025-10", "indexValue": 131.2 }`
  - **Response:** Updated full state.

---

## 4. Directory and File Structure Mapping

To ensure strict separation of concerns, maintainability, and modularity, the GAS codebase and frontend are structured as follows:

- **`api.gs`**
  - **Role:** The entry point for the REST API. Contains `doGet(e)`, `doPost(e)`, and `doOptions(e)`. Handles routing, request parsing, and error catching.
- **`db_controllers.gs`**
  - **Role:** Handles all direct interactions with the Google Sheets database. Includes functions like `readSheet()`, `updateRow()`, `appendRow()`, and `getAggregates()`.
- **`grace_engine.gs`**
  - **Role:** Encapsulates the financial logic for recalculating Grace period interest for unlocked months based on active drawn funds and varying interest rates.
- **`index_guard.gs`**
  - **Role:** Houses the new IndexGuard module logic. Calculates the linkage penalty (Index_Delta) on the remaining undrawn contractor balance.
- **`index.html`**
  - **Role:** The frontend PWA containing HTML, CSS, and Vanilla JavaScript. Handles API requests, state management, and rendering of the Dashboard, Progress Tracks, and Monthly Ledger.

---

## 5. Core Logic & Algorithms

### 5.1 Recursive Grace Calculation
The `grace_engine.gs` recalculates interest for all **unlocked** rows in the ledger sequentially:

1. **State Injection:** For month $M_i$, the previous month's end balance is fetched: $E_{i-1}$. If $M_i$ is locked, skip entirely.
2. **Active Drawn Assessment:** Calculate total drawn funds up to $M_i$ per track based on the `Milestones` sheet.
3. **Interest Calculation:**
   - Mishtana: $(Drawn_{Mishtana} \times Rate_{Mishtana}) / 12$
   - Kavua: $(Drawn_{Kavua} \times Rate_{Kavua}) / 12$
   - Prime: $(Drawn_{Prime} \times Rate_{Prime}(M_i)) / 12$
   - $Grace\_Deduction_i = Sum \ of \ the \ above$.
4. **End Balance Calculation:**
   $End\_Balance_i = E_{i-1} + Inflows_i - Grace\_Deduction_i$

### 5.2 IndexGuard Delta Formula
The `index_guard.gs` module calculates the impact of the Construction Input Index on the remaining undrawn funds.

1. **Undrawn Balance Calculation:**
   $Undrawn\_Balance_i = Total\_Contract\_Amount - Total\_Drawn(M_i)$
2. **Index Delta Assessment:**
   Find the latest `Construction_Index` value applicable to $M_i$ ($Index_{Current}$) and compare it against the `Base_Construction_Index` ($Index_{Base}$).
3. **Linkage Formula:**
   $Linkage\_Multiplier_i = (Index_{Current} / Index_{Base}) - 1$
   $Index\_Delta\_Cost_i = Undrawn\_Balance_i \times Linkage\_Multiplier_i$
4. **Integration into Ledger (Optional/Display):** While the Grace deduction affects the liquid balance directly, the `Index_Delta_Cost` represents the dynamic increase in the principal debt owed to the contractor. The system tracks this month-by-month to project the final required capital.