# BrewLite — Release Notes (v1.0.0 Production)

- **Production URL:** https://brewlite.duckdns.org
- **Demo Video (End-to-End Flow):** https://drive.google.com/file/d/1uwnyQYlfJe3_WLpb97oH4A49crlGU_pa/view?usp=drive_link
- **Release Date:** 2026-11-13

## Completed Scope
- **Order History & State Machine:** Enforced order status lifecycle (`PENDING` -> `PAID` -> `PREPARING` -> `READY` -> `COMPLETED`) and real-time order tracking.
- **Promotions & Loyalty System:** Voucher validation (`HELLOBREW`), loyalty point accrual (1 point per 10,000 VND on `PAID` orders), and point-to-voucher redemption.
- **Payment & Deployment:** Integrated payment flow and deployed Docker Compose stack (`web`, `api`, `postgres`) on AWS EC2 with HTTPS reverse proxy.