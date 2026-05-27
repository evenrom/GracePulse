# GracePulse - Product Requirements Document (PRD)

## 1. Project Overview
**GracePulse** is a progressive web application (PWA) tailored for personal financial management, specifically designed to track, forecast, and audit a complex mortgage grace period. It acts as an immutable ledger that calculates recursive monthly compounding dynamics, dynamic Prime rate adjustments, and integrates an auditing engine (IndexGuard) to benchmark contractor index demands against legal caps.

## 2. Target Audience & Use Case
- **Primary User:** Homebuyer managing a multi-track mortgage with delayed disbursements and a grace period (interest-only payments).
- **Core Problem:** Banks and contractors provide opaque, hard-to-track financial demands. Users need to know exactly how much they owe, what their future cash flow looks like, and whether the contractor is overcharging on linkage indices.
- **Solution:** A deterministic, single-source-of-truth ledger that projects future grace payments and audits linkage charges.

## 3. Core User Flows
### Flow A: Monthly Ledger Management
1. User opens the dashboard and views current liquidity and total projected final balance.
2. User expands an upcoming, unlocked month in the Ledger list.
3. User inputs actual planned inflows (Income Rom, Income Yael, Deposits).
4. System recalculates expected Grace Deduction in real-time.
5. Once the month concludes and the bank issues the actual charge, the user updates the Grace Deduction field in the DB, locks the month (`Is_Locked = TRUE`), and the system freezes the record while cascading the liquidity balance forward.

### Flow B: IndexGuard (Linkage Audit)
1. User receives a payment demand from the contractor.
2. User opens the IndexGuard bottom-sheet component.
3. User inputs the *Current Construction Index*.
4. System automatically compares the contractor's specific linkage rights against statutory legal caps (Amendment 9).
5. System displays the Delta. If the contractor charges are valid, the user approves the specific amount.
6. System injects the charge as a new principal milestone in the DB, which automatically begins accruing interest in the main ledger.

## 4. Data Model Strategy
- **Single Source of Truth (SSOT):** Google Sheets acts as the relational database.
- **Immutability:** Locked ledger rows are never recalculated by the math engine. Only the rolling `End_Balance` is forwarded.
- **Recursive State:** The system state is entirely derived from historical milestones, prime rates, and previous ledger balances.