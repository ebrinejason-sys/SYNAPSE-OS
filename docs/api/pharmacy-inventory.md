# API Documentation — Pharmacy Inventory & POS (Phase 1)

## Shared domain: `@synapse/db/inventory`
Pure, dependency-free functions — the single source of truth for "sellable" stock. Usable in
Next.js routes, React Native, and tests.

- `summarizeInventory(product, batches, today?) → InventorySummary`
  `{ physicalQuantity, sellableQuantity, expiredQuantity, quarantinedQuantity, damagedQuantity,
  unbatchedQuantity, hasBatches, hasPhantomStock }`. `product.quantity` only feeds `unbatchedQuantity`;
  it is never counted as sellable.
- `allocateFefo(batches, qtyNeeded, { today?, pinBatchId? }) → BatchAllocation[]` — active,
  in-date, positive batches only, earliest-expiry-first; `pinBatchId` = manager manual override.
- `buildStockError({ product, batches, requestedQuantity, today? }) → StructuredStockError | null` —
  `{ productId, productName, requestedQuantity, sellableQuantity, reasonCode, humanMessage,
  recommendedAction }` with `reasonCode ∈ {INSUFFICIENT_STOCK, NO_SELLABLE_BATCHES, PRODUCT_INACTIVE,
  EXPIRED_ONLY, QUARANTINED_ONLY, UNBATCHED_STOCK, REQUIRES_BATCH}`.
- `isSellableBatch`, `normaliseBatch`, `kampalaToday`, `daysUntilExpiry`, `parseRpcStockError`.

## Shared domain: `@synapse/db/import-validation`
- `validateImportRow(row, rowNumber, { today?, requireBatchForStock? })` and
  `validateImportRows(rows, opts)` — require genuine batch number + positive integer quantity +
  non-past expiry to make previously-unbatched medicine sellable; never fabricates batch/expiry.

## HTTP: catalog (updated, additive fields)
`GET /api/mobile/pharmacy/pos/products` and `GET /api/admin/inventory` now also return per product:
`sellableQuantity`, `physicalQuantity`, `expiredQuantity`, `unbatchedQuantity`, `hasPhantomStock`.
`quantity` is retained for backwards compatibility. `batches[]` now lists **only sellable** batches
(active + in-date + positive). **POS clients must validate against `sellableQuantity`.**

## HTTP: checkout error (updated, additive field)
`POST /api/mobile/pharmacy/pos/complete-sale` and `POST /api/admin/pos/complete-sale` — on a stock
failure the JSON now includes `stockError` (the `StructuredStockError` above) alongside the existing
`error` (human string) and `code`. Example:
```json
{ "error": "Not enough stock on active (non-expired) batches for this sale.",
  "code": "INSUFFICIENT_STOCK",
  "stockError": { "productId": "…", "productName": "Amoxicillin 500mg",
    "requestedQuantity": 10, "sellableQuantity": 3, "reasonCode": "INSUFFICIENT_STOCK",
    "humanMessage": "Only 3 of Amoxicillin 500mg is sellable; 10 requested.",
    "recommendedAction": "Reduce the quantity to 3 or receive more stock." } }
```

## SQL (migration `20260805130000_pharmacy_inventory_authority.sql`)
- View `pharmacy_inventory_summary(product_id, tenant_id, name, product_quantity, physical_quantity,
  sellable_quantity, expired_quantity, quarantined_quantity, damaged_quantity, unbatched_quantity)`.
- `report_unbatched_positive_stock(p_tenant_id uuid)` → legacy phantom-stock report.
- `receive_pharmacy_stock(p_tenant_id, p_product_id, p_batch_number, p_quantity, p_expiry_date,
  p_cost_price?, p_received_by?, p_supplier_ref?) → jsonb` — the sanctioned way to add sellable stock.
- `complete_pharmacy_sale(...)` — unchanged signature; excludes non-`active` batches; structured
  `INSUFFICIENT_STOCK` message.
