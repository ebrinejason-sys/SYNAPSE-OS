# 80mm thermal printer GREEN checklist

Printer failure must not duplicate a sale, reverse a sale, or change stock/payment.

| Check | Expected | Result |
| ----- | -------- | ------ |
| Receipt width / wrap | Readable 80mm wrap | BLOCKED |
| Pharmacy name + branch | Present | BLOCKED |
| Receipt number | Present and stable on reprint | BLOCKED |
| Cashier + date/time | Present | BLOCKED |
| Line items, qty, unit price, discount, total | Present | BLOCKED |
| Payment method | Present; offline card/momo shows unverified | BLOCKED |
| Offline pending-sync marker | Shown when sale is queued | BLOCKED |
| Refund status | Shown after void | BLOCKED |
| Reprint / share / retry print | Available without a new sale | BLOCKED |
| Printer unplugged during print | Sale and stock unchanged | BLOCKED |

Device, printer model, APK build, tester, and date must be filled by the operator. This environment has no thermal printer.
