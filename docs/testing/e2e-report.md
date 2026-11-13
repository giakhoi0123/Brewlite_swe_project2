# BrewLite — End-to-End (E2E) Verification Report

- **Environment:** Production (`https://brewlite.duckdns.org`)
- **Video Evidence:** https://drive.google.com/file/d/1uwnyQYlfJe3_WLpb97oH4A49crlGU_pa/view?usp=drive_link
- **Tested By:** Duy (Task 9 & Final Integration)

## Verified Test Cases
| ID | Flow | Expected Result | Status |
|---|---|---|---|
| E2E-01 | Menu & Cart | Add items with size/options and calculate subtotal accurately | PASS |
| E2E-02 | Promo Validation | Apply promo code (`HELLOBREW`) and deduct discount from total | PASS |
| E2E-03 | Payment Flow | Submit payment request (`200/201`) and transition order to `PAID` | PASS |
| E2E-04 | Order History | Display newly paid order with accurate items, discount, and status | PASS |
| E2E-05 | Loyalty Accrual | Automatically credit loyalty points upon `PAID` order completion | PASS |