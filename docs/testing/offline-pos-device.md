# Offline POS — physical device checklist

Run on one Android counter with a known catalogue (at least one sellable batch).
Do not mark `offline_durable_pos` PILOT_READY until every row is PASS.

| Case | Steps | Expected |
| ---- | ----- | -------- |
| A | Online cash sale; kill network after spinner starts; retry | One receipt. Sync status not duplicated. |
| B | Airplane mode → complete cash sale (Pending sync) → force-stop → reboot → open app | Same pending command still listed; retry syncs once. |
| C | After B, pull network, crash the app during “Retry sync now” | Restart + retry still one server sale. |
| D | Snapshot qty 5; offline sell 3; attempt offline sell 3 | Second sale blocked with remaining quantity in the message. |
| E | Change server stock below reserved qty, then sync | Command Failed / Needs review. Snapshot not silently overwritten. |
| F | Dev-only: replay same commandId with mutated payload | Needs review. Original payload kept. |

Receipts must say **Pending sync** until acknowledged. Card/mobile-money must say
**unverified**. Printer failure must not create a second sale.
