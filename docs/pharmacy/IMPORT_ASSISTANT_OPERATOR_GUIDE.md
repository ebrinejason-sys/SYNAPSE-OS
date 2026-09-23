# Import Assistant - Operator Guide

## Quick Start: Importing Inventory from CSV

This guide walks through using the Import Assistant to bulk-load products and stock from CSV exports (Tally, Excel, QuickBooks, etc.) into Synapse Pharmacy.

---

## Step 1: Prepare Your Data

Export your inventory to CSV format. Common exports include:
- Tally stock reports
- QuickBooks inventory lists
- Excel stock-taking sheets
- Supplier catalogs

### Supported Columns

The system can automatically map these fields:

| Your CSV Column | Maps To | Required? | Examples |
|----------------|---------|-----------|----------|
| Item, Name, Product, Drug, Medicine | **Product Name** | ✅ Yes | Panadol 500mg, Amoxicillin |
| Generic, Ingredient | Generic Name | No | Paracetamol, Amoxicillin |
| Qty, Quantity, Stock, Units | **Quantity** | Recommended | 120, 50 |
| Price, Selling, Retail, Sale | Selling Price | No | 500, 1200 |
| Cost, Buying, Purchase, Wholesale | Cost Price | No | 300, 800 |
| Expiry, Expire, Exp, Best Before | **Expiry Date** | Recommended | 2027-01-01, 31/12/2027 |
| Batch, Lot | Batch Number | Recommended | B123, LOT-456 |
| SKU, Code, Item No | SKU | No | SKU001, ITEM-789 |
| Barcode, EAN | Barcode | No | 5012345678901 |
| Manufacturer, Maker, Brand | Manufacturer | No | Cipla, Ranbaxy |
| Unit, UOM, Pack | Unit of Measure | No | Tablet, Capsule |
| Category, Class | Category | No | Antibiotics, Analgesics |

**Note**: Only **Product Name** is strictly required. Quantity and Expiry are needed to receive stock.

---

## Step 2: Access Import Assistant

1. Log in to Synapse Pharmacy
2. Navigate to **Portal → Import Assistant** (`/portal/import-assistant`)
3. You'll see the "Auto-Migration Assistant" page

---

## Step 3: Enter CSV Data

### Fill in the form:

**Source system** (optional)
- Example: "Tally Export", "QuickBooks", "Excel Stock Taking"
- Helps track where data came from

**File name** (optional)
- Example: "stock-export-june-2026.csv"
- For reference in import history

**CSV headers** (required)
- Comma-separated list of your column names
- Example: `Item, Qty, Selling Price, Expiry, Batch`

**Sample rows** (required)
- Paste 5-20 sample rows from your CSV
- One row per line, comma-separated values
- Example:
  ```
  Panadol 500mg, 120, 500, 2027-02-01, B123
  Amoxicillin 250mg, 80, 1200, 2026-11-30, A77
  Ciprofloxacin 500mg, 50, 2500, 2027-06-15, C456
  ```

### Click "Generate mapping"

The system analyzes your columns and maps them to Synapse fields automatically.

---

## Step 4: Review Mapping

You'll see a **Mapping preview** table showing:

| Source column | Synapse field | Confidence | Status |
|--------------|---------------|------------|--------|
| Item | name | 90% | ✅ Mapped |
| Qty | quantity | 90% | ✅ Mapped |
| Selling Price | price | 90% | ✅ Mapped |
| Expiry | expiry_date | 90% | ✅ Mapped |
| Batch | batch_number | 90% | ✅ Mapped |

**Status meanings:**
- ✅ **Mapped** (green): Column successfully matched to a Synapse field
- ⚠️ **Review** (yellow): Column not recognized, may need manual mapping

**What to check:**
- Essential fields are mapped: name, quantity, expiry_date
- Prices mapped correctly (selling vs. cost)
- No critical columns marked as "unmapped"

**Summary message:**
- "All supplied columns were mapped with high confidence." ✅
- "3 columns need review before import." ⚠️

---

## Step 5: Apply Import

Once you're satisfied with the mapping:

### Click the green "Apply Import" button

**What happens:**
1. Status changes to **importing** (blue badge)
2. System processes each row:
   - Checks if product exists (by barcode, SKU, or name)
   - Creates new products if not found
   - Receives stock with batch and expiry
3. Shows results when complete

**⏱️ Processing time:**
- 10-20 rows: ~5 seconds
- 100 rows: ~15-30 seconds
- 500+ rows: ~1-2 minutes

**💡 Tip**: For very large imports (>1000 rows), consider breaking into smaller batches.

---

## Step 6: Review Results

After import completes, you'll see an **Import Results** card:

### Summary boxes:

```
┌─────────────┬─────────────┬─────────────┐
│   Success   │   Failed    │   Skipped   │
│     120     │      3      │      2      │
└─────────────┴─────────────┴─────────────┘
```

**Success** (green): Products created and stock received  
**Failed** (red): Rows that encountered errors  
**Skipped** (yellow): Rows missing required data (usually no product name)

### Failed Rows Section

If any rows failed, you'll see details:
```
Failed rows:
Row 25: Aspirin 100mg - Product with this SKU already exists
Row 47: Unknown - Missing product name
Row 89: Paracetamol - EXPIRED_RECEIPT: Cannot receive stock that is already expired
```

**Common failure reasons:**
- Missing product name (will be skipped instead)
- Already expired date
- Invalid date format (not auto-parsed)
- Duplicate SKU conflict (rare - system usually matches existing)

---

## Step 7: Verify in Inventory

Navigate to **Portal → Inventory** to confirm:

✅ New products appear in the catalog  
✅ Stock quantities match your import  
✅ Batches created with correct expiry dates  
✅ Prices (selling/cost) populated when provided  

### Check a specific product:
1. Search for product name (e.g., "Panadol")
2. Click product row
3. View **Batches** tab to see:
   - Batch numbers from import
   - Expiry dates
   - Quantity per batch
   - Cost price

---

## Import History

The **Recent import sessions** table shows all your imports:

| File | Source | Status | Matched | Flagged |
|------|--------|--------|---------|---------|
| stock-export-june.csv | Tally Export | ✅ complete | 125 | 0 |
| manual-mapping-session | Unknown | ⚠️ review | 8 | 2 |
| supplier-catalog.csv | Excel | ❌ failed | 0 | 50 |

**Status badges:**
- ✅ **complete** (green): Successfully imported
- ⚠️ **review** (yellow): Mapped but not yet applied
- 🔵 **importing** (blue): Currently processing
- ❌ **failed** (red): Import encountered critical errors

**Note**: You cannot re-apply a completed session. Create a new session if you need to re-import the same data.

---

## Best Practices

### ✅ Do's

1. **Start small**: Test with 10-20 rows first to verify mapping
2. **Check dates**: Ensure expiry dates are in the future
3. **Include batches**: Provide batch numbers when available (or system auto-generates)
4. **Verify SKUs**: Include SKUs to help match existing products
5. **Review results**: Check failed rows and address issues
6. **Keep originals**: Don't delete source CSV in case you need to retry

### ❌ Don'ts

1. **Don't skip verification**: Always check a few products in inventory after import
2. **Don't import duplicates**: System matches existing products, but check manually first
3. **Don't use expired dates**: Imports with past expiry dates will fail
4. **Don't re-apply sessions**: Create a new session instead of trying to re-apply
5. **Don't ignore failed rows**: Investigate and fix, then import separately

---

## Common Scenarios

### Scenario 1: Migrating from Tally

**Your Tally export has:**
- Drug Name, Quantity, MRP (selling price), Rate (cost price), Expiry

**Steps:**
1. Headers: `Drug Name, Quantity, MRP, Rate, Expiry`
2. Map: Drug Name→name, Quantity→quantity, MRP→price, Rate→cost_price, Expiry→expiry_date
3. Apply import
4. Result: Products created with both selling and cost prices

### Scenario 2: Stock-Taking Results

**Your Excel sheet has:**
- Item, Count, Batch No, Expiry Date

**Steps:**
1. Headers: `Item, Count, Batch No, Expiry Date`
2. Map: Item→name, Count→quantity, Batch No→batch_number, Expiry Date→expiry_date
3. Apply import
4. Result: Stock quantities updated with correct batches

### Scenario 3: Supplier Catalog

**Supplier CSV has:**
- Product Code, Description, Barcode, Unit Price

**Steps:**
1. Headers: `Product Code, Description, Barcode, Unit Price`
2. Map: Product Code→sku, Description→name, Barcode→barcode, Unit Price→cost_price
3. No quantity/expiry provided → products created but no stock
4. Result: Catalog populated, ready for future receiving

### Scenario 4: Updating Existing Products

**You have products already in Synapse, want to add stock:**

**Steps:**
1. Include SKU or barcode in your CSV (matches existing products)
2. Provide quantity and expiry
3. Apply import
4. Result: Stock added to existing products (no duplicates created)

---

## Troubleshooting

### "Import session not found"
- Session may have been deleted
- Check you're logged into the correct tenant

### "Import session has already been applied"
- Session completed previously
- Create new session with same data if needed

### All rows show "Skipped"
- Check if product names are in the first column
- Verify CSV headers match your data columns

### Products created but no stock
- Missing expiry dates (stock requires expiry)
- Check failed rows section for specific errors

### Wrong products matched
- System matches by barcode > SKU > name
- Ensure identifiers are unique
- Consider clearing barcodes/SKUs if causing false matches

### Dates not parsing
- Supported formats: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY
- Check date separators (/ or -)
- Ensure dates are future dates

---

## FAQs

**Q: Can I import without expiry dates?**  
A: Yes, products will be created but stock won't be received. Add stock manually later.

**Q: What if I don't have batch numbers?**  
A: System auto-generates batch numbers like `BATCH-1727098234-0` if not provided.

**Q: Can I update existing product prices?**  
A: Yes, if the product is matched (by barcode/SKU/name), prices are updated when provided.

**Q: How do I import 10,000+ products?**  
A: Break into batches of 500-1000 rows each to avoid timeouts.

**Q: Can I undo an import?**  
A: Not automatically. You'd need to manually adjust stock or delete products.

**Q: Does this replace manual receiving?**  
A: No, this is for bulk initial imports. Use normal receiving workflow for ongoing purchases.

**Q: What permissions do I need?**  
A: "Inventory Adjust" permission (typically pharmacy admin/manager).

---

## Support

For issues or questions:
1. Check failed rows section for specific error messages
2. Verify your CSV format matches examples
3. Test with small sample before full import
4. Contact system administrator if problems persist

---

## Summary

The Import Assistant makes it easy to migrate from legacy systems:

1. ✅ **Export** your data to CSV
2. ✅ **Paste** headers and sample rows
3. ✅ **Review** automatic mapping
4. ✅ **Apply** to create products and receive stock
5. ✅ **Verify** in inventory

No manual data entry for hundreds or thousands of products! 🎉
