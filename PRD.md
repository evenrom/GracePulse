# GracePulse: Product Requirements Document (PRD) & System Architecture

**To:** Dexter, VP R&D
**From:** Jules, Lead Full-Stack Developer
**Date:** [Current Date]

---

## 1. Executive Summary

**GracePulse** is a lightweight, mobile-first Progressive Web Application (PWA) designed to manage and track a 1,635,000 ILS mortgage during its grace period (Oct 2025 to May 2027). The system calculates monthly interest deductions across three specific mortgage tracks (Mishtana 5, Kavua, Prime) based on a defined schedule of contractor payment milestones.

The architecture is entirely serverless, utilizing Vanilla JS/HTML/CSS on the frontend and leveraging Google Sheets via Google Apps Script (GAS) as the backend database and REST API. The core feature is a strict locking mechanism to guarantee historical data immutability while allowing future, unlocked months to dynamically recalculate based on append-only prime rate updates.

## 2. User Flow

1. **Dashboard Initialization:** User opens the PWA. The app fetches the current state from the GAS API.
2. **At-a-Glance View:** The user views the Sticky Top Dashboard displaying the **Current Liquid Balance** and the **Total Remaining to Pay** to the contractor.
3. **Track Monitoring:** The user scrolls to the "Tracks Progress" section to visually inspect Drawn vs. Total Allocated funds for Mishtana 5, Kavua, and Prime via progress bars.
4. **Monthly Ledger & Approval:**
   - The user views the Monthly Ledger (accordion/card format) displaying month-by-month grace deductions.
   - For the current active month, the user clicks the **"Approve Month"** button.
   - The app sends a request to the GAS API to lock the month.
   - Upon success, the UI updates to reflect the month as locked (`Is_Locked = TRUE`), rendering its values immutable.
5. **Prime Rate Update (Admin/System):** If the Prime rate changes, a new rate is appended to the Prime Rate Ledger. The UI and DB recalculate future (unlocked) months based on the new rate.

## 3. Architecture Diagram (Textual)

```text
[ Client (PWA) ]
      |
      |-- Frontend Stack: HTML5, CSS3, Vanilla JS
      |-- UI/UX: Mobile-First, Rubik/Assistant Fonts
      |-- State: Fetches JSON data, handles UI interactions (Locking, accordions)
      |
      v
[ HTTPS REST API ]
      |
      |-- Endpoint: Google Apps Script (GAS) web app URL
      |-- Method: GET (Fetch state) / POST (Lock month, Update rates)
      |-- Security: CORS enabled, basic auth/token if required
      |
      v
[ Backend/DB (Google Sheets) ]
      |
      |-- Sheet ID: 1QKGzluWoqS_jsQl5v6T4U_tPBicYwP7RlSkDKyoeli8
      |-- Logic: GAS computes interest, manages locking, handles recalculations
      |-- Tables (Sheets):
            1. 'Ledger' (Monthly calculations & states)
            2. 'Prime_Rates' (Append-only rate history)
            3. 'Milestones' (Read-only contractor payments)
```

## 4. API Endpoints Needed (GAS)

The Google Apps Script will expose a single `doGet` / `doPost` entry point, routing requests based on an `action` payload.

* **`GET /exec?action=getState`**
  * **Description:** Retrieves the complete state required for the UI.
  * **Returns:** JSON object containing:
    * Dashboard aggregates (Liquid Balance, Total Remaining).
    * Track summaries (Total vs Drawn).
    * Monthly ledger array (Month, Drawn Amount, Grace Deduction, End Balance, Is_Locked status).

* **`POST /exec` (Payload: `{ "action": "lockMonth", "month": "YYYY-MM" }`)**
  * **Description:** Locks a specific month.
  * **Logic:** Finds the row for `YYYY-MM`, sets `Is_Locked = TRUE`. Triggers recalculation for all subsequent rows.
  * **Returns:** Updated state or success/error status.

* **`POST /exec` (Payload: `{ "action": "addPrimeRate", "date": "YYYY-MM", "rate": float }`)**
  * **Description:** Appends a new prime rate to the ledger.
  * **Logic:** Adds row to `Prime_Rates` sheet. Recalculates all unlocked months in the `Ledger` sheet based on the new effective rate.
  * **Returns:** Updated state.

## 5. Strict DB Schema Considerations

### 5.1 The Genesis Row & Immutability
- **Genesis State:** The `Ledger` sheet must start with row `2025-9`.
  - `End_Balance` = 2000 ILS.
  - `Is_Locked` = `TRUE`.
- **First Month Anomaly & Hardcoded Values:** Historical months (e.g., `2025-10` with `484.36 ILS`) have exact manual deductions.
- **Recalculation Rule:** Any GAS script recalculating the spreadsheet **MUST STRICTLY SKIP** any row where `Is_Locked == TRUE`. The `Grace_Deduction` and `End_Balance` of locked rows are absolute and immutable.

### 5.2 Interest Calculation
- **Formula:** `(Active Drawn Amount * Annual Rate) / 12`
- **Precision:** Rough monthly estimation is acceptable; strict daily compounding is ignored.

### 5.3 Prime Rate Ledger (Append-Only)
- The `Prime_Rates` sheet acts as an append-only log.
- **Columns:** `Effective_Month` (YYYY-MM), `Prime_Rate_Value`
- When recalculating unlocked months in the `Ledger`, the script must query the `Prime_Rates` sheet to find the latest effective rate applicable to that specific month. Changing a rate **never** affects a row where `Is_Locked == TRUE`.

### 5.4 Tracks & Milestones
- **Tracks Definition:**
  - **Mishtana 5:** 327,000 ILS (4.85%)
  - **Kavua:** 654,000 ILS (4.80%)
  - **Prime:** 654,000 ILS (P-0.7%)
- **Milestones Execution:** The system must map these draw-downs dynamically to the respective months in the `Ledger`.
  - `01/10/25`: 327K -> Mishtana 5
  - `01/04/26`: 436K -> Prime
  - `01/10/26`: 436K -> Prime (218K) + Kavua (218K)
  - `01/02/27`: 218K -> Kavua
  - `01/04/27`: 218K -> Kavua

---