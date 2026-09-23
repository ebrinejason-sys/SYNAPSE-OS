# Import Assistant Apply Functionality - Testing Guide

## Overview

The Import Assistant Apply functionality enables bulk creation/update of pharmacy products and stock receiving from CSV imports. This document provides comprehensive testing instructions.

## What Apply Actually Does

### High-Level Flow

1. **Product Matching**: For each row, checks if product exists by:
   - Barcode (exact match, case-insensitive)
   - SKU (exact match, case-insensitive)  
   - Name (exact match, case-insensitive)

2. **Product Creation**: If no match found, creates new product with:
   - Auto-generated SKU if not provided
   - Mapped fields (name, generic_name, barcode, manufacturer, etc.)
   - Default category: "General"
   - Default unit: "Tablet"
   - Prices from CSV (price, cost_price)
   - `createAnyway: true` to bypass duplicate detection

3. **Stock Receiving**: If quantity and expiry provided:
   - Calls `receivePharmacyStock` RPC (same as manual receiving)
   - Sets absolute quantity (not additive)
   - Creates batch with expiry date
   - Auto-generates batch number if missing: `BATCH-{timestamp}-{rowIndex}`

4. **Result Tracking**: Returns per-row results:
   - Success: Product created/matched and stock received
   - Failed: With specific error message
   - Skipped: Missing required fields (name)

### Idempotency Strategy

- **Session-level**: Re-applying same session is prevented (status check)
- **Product-level**: Set absolute quantity via `receivePharmacyStock`
- **No automatic deduplication**: Each apply creates new batches/movements

## Manual Testing Steps

### Prerequisites

1. Access to `/portal/import-assistant` as pharmacy admin
2. Sample CSV data prepared (see below)
3. Clean test environment or willingness to have test data

### Test Case 1: Basic Happy Path

**Input Data:**
```
Headers: Item, Qty, Selling Price, Expiry, Batch
Rows:
Panadol 500mg, 120, 500, 2027-02-01, B123
Amoxicillin 250mg, 80, 1200, 2026-11-30, A77
Ciprofloxacin 500mg, 50, 2500, 2027-06-15, C456
```

**Expected Outcome:**
- 3 products created with correct names
- Stock quantities: 120, 80, 50
- Batches created with correct expiry dates
- Success count: 3, Failed: 0, Skipped: 0

**Verification:**
1. Navigate to `/portal/inventory`
2. Search for "Panadol 500mg" - should show 120 units
3. Click product → Check batches tab
4. Verify batch B123 with expiry 2027-02-01

### Test Case 2: Missing Expiry Date

**Input Data:**
```
Headers: Item, Qty, Selling Price
Rows:
Test Product A, 100, 5000
Test Product B, 50, 3000
```

**Expected Outcome:**
- 2 products created
- No stock received (missing expiry)
- Success count: 2 (products created)
- Warning in results: "Product created but stock not added (missing expiry date)"

**Verification:**
- Products exist in catalog
- Quantity shows 0 in inventory

### Test Case 3: Missing Product Name

**Input Data:**
```
Headers: Item, Qty, Selling Price, Expiry, Batch
Rows:
, 100, 5000, 2027-01-01, B1
Valid Product, 50, 3000, 2027-01-01, B2
, 25, 1000, 2027-01-01, B3
```

**Expected Outcome:**
- Success: 1 (Valid Product)
- Skipped: 2 (rows 1 and 3)
- Skipped reason: "Missing product name"

### Test Case 4: Existing Products

**Setup:**
1. First, apply this data:
```
Headers: Item, SKU, Barcode, Qty, Selling Price, Expiry, Batch
Rows:
Paracetamol 500mg, SKU001, 123456789, 100, 500, 2027-01-01, B1
```

2. Then apply this data:
```
Headers: Item, SKU, Barcode, Qty, Selling Price, Expiry, Batch
Rows:
Different Name, SKU001, 987654321, 50, 600, 2027-02-01, B2
Another Name, 999888777, 123456789, 75, 700, 2027-03-01, B3
```

**Expected Outcome:**
- Row 1: Matches by SKU → adds 50 units to existing product (total: 150)
- Row 2: Matches by barcode → adds 75 units to existing product (total: 225)
- No new products created (both matched existing)

### Test Case 5: Date Format Variations

**Input Data:**
```
Headers: Item, Qty, Selling Price, Expiry, Batch
Rows:
Product A, 10, 1000, 2027-12-31, B1
Product B, 10, 1000, 31/12/2027, B2
Product C, 10, 1000, 12-31-2027, B3
Product D, 10, 1000, 31-12-2027, B4
Product E, 10, 1000, 12/31/27, B5
```

**Expected Outcome:**
- All 5 products created with stock
- All expiry dates parsed to 2027-12-31
- Success: 5

### Test Case 6: Re-Application Prevention

**Steps:**
1. Apply any valid import session
2. Wait for status to change to "complete"
3. Try to apply the same session again

**Expected Outcome:**
- Error: "Import session has already been applied"
- No duplicate products or stock created

### Test Case 7: Comprehensive Fields

**Input Data:**
```
Headers: Item, Generic Name, SKU, Barcode, Qty, Selling Price, Cost Price, Expiry, Batch, Manufacturer, Unit
Rows:
Amoxicillin 500mg Capsules, Amoxicillin, AMX500, 5012345678901, 200, 1500, 800, 2027-08-15, BATCH-2024-001, Cipla, Capsule
Metformin 500mg Tablets, Metformin HCl, MET500, 5019876543210, 500, 200, 100, 2028-12-31, BATCH-2024-002, Ranbaxy, Tablet
```

**Expected Outcome:**
- 2 products created with all fields populated:
  - Generic names set
  - Custom SKUs used
  - Barcodes set
  - Manufacturers set
  - Cost prices set
  - Unit of measure set
- Stock received with correct quantities and batches

**Verification:**
- Check product details show all mapped fields
- Verify cost price appears in purchase/stock views

### Test Case 8: Large Batch Import

**Input Data:**
100 rows of unique products with varying:
- Names (Product 001 - Product 100)
- Quantities (random 10-500)
- Prices (random 100-5000)
- Expiry dates (2026-2028)
- Batch numbers (BATCH-001 to BATCH-100)

**Expected Outcome:**
- Success: 100
- Processing time: < 30 seconds
- All products appear in inventory
- Session status: "complete"

**Performance Check:**
- Monitor browser console for errors
- Check server logs for timeouts
- Verify database remains responsive

## Edge Cases & Error Scenarios

### Case 1: Invalid Expiry Date
```
Input: Expiry = "invalid-date"
Expected: Product created, no stock, success with warning
```

### Case 2: Negative Quantity
```
Input: Qty = "-50"
Expected: May fail or create with 0 (check actual behavior)
```

### Case 3: Extremely Long Names
```
Input: Item = "A" * 500 (500 character name)
Expected: Should handle gracefully (check DB field limits)
```

### Case 4: Special Characters
```
Input: Item = "Panadol™ 500mg (Extra®)"
Expected: Product created with special chars preserved
```

## Integration Points to Verify

### 1. Audit Logs
Check `pharmacy_audit_logs` for:
- Action: `import.applied`
- Details include: source, file, success/failed/skipped counts
- Profile ID matches current user

### 2. Session Status Transitions
Check `pharmacy_import_sessions` for:
- Initial: `review`
- During: `importing`
- Final: `complete` or `failed`
- `completed_at` timestamp set
- `ai_summary` updated with results

### 3. Product Creation
Check `pharmacy_products` for:
- Correct `tenant_id`
- `is_active = true`
- `created_by` set
- Auto-generated SKU format: `SKU-{timestamp_base36}`

### 4. Stock Movements
Check `pharmacy_stock_movements` via inventory for:
- Movement type: RECEIVE (from `receivePharmacyStock`)
- Quantity matches import
- Reason includes import reference
- `supplier_ref` includes session file name

### 5. Batches
Check `pharmacy_product_batches` for:
- Batch number from CSV or auto-generated
- Expiry date correctly parsed
- Cost price set when provided
- Remaining quantity = initial quantity

## Known Limitations

1. **No rollback**: Failed imports are partial - successful rows persist
2. **No update mode**: Always creates new batches, doesn't update existing batch quantities
3. **Simple matching**: No fuzzy matching or similarity scoring beyond exact matches
4. **Auto-batch naming**: May generate non-semantic batch numbers
5. **No validation preview**: Can't simulate apply without actually writing data
6. **Single-pass**: No batch chunking for very large imports (>5000 rows may timeout)

## Troubleshooting

### "Import session not found"
- Check session ID in URL matches selected session
- Verify user has access to the tenant that owns the session

### "Import session has already been applied"
- Session status is `complete` - cannot re-apply
- Create new session with same data if re-import needed

### "Product with this SKU already exists"
- Should not occur with `createAnyway: true`
- If it does, indicates race condition or stale product cache

### Stock not showing after import
- Check if expiry date was provided
- Look for "missing expiry date" in results
- Verify batch created in product batches view

### Timeout on large imports
- Break into smaller batches (< 1000 rows recommended)
- Check server logs for actual error
- Consider increasing API timeout if available

## Success Criteria

✅ Products created with correct attributes  
✅ Stock quantities match import data  
✅ Batches created with correct expiry dates  
✅ Failed rows reported with clear reasons  
✅ Skipped rows (missing name) don't create empty products  
✅ Session status updates correctly  
✅ Audit logs capture import action  
✅ No duplicate products on re-import of same data  
✅ Session re-application prevented  
✅ TypeScript compiles without errors  
✅ No console errors during apply  

## Next Steps After Testing

1. Document any bugs found in GitHub issues
2. Consider adding import preview mode (dry run)
3. Add batch update mode (update existing batch quantities)
4. Implement fuzzy product matching for better duplicate detection
5. Add CSV upload for larger files (current: paste sample data only)
6. Add progress indicator for large imports
7. Consider background job processing for very large imports
