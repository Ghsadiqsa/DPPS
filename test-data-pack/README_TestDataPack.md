# DPPS End-to-End Test Data Pack

## Files Included:
- **DPPS_TestDataPack.xlsx**: The primary data source.
  - `VENDORS`: 150 Master data records.
  - `FINANCIAL_DOC_HISTORY`: 1000 historical paid invoices.
  - `PAYMENT_GATE_UPLOAD`: 250 rows for the proposal gate.
- **DPPS_ScenarioCatalogue.xlsx**: Breakdown of 15 standard duplicate scenarios.
- **CSV_Versions/**: Flattened versions of all sheets for quick CLI testing.

## E2E Workflow Steps:
1. **Import Vendors**: Go to Historical Load -> Change Entity to "Vendors" -> Upload `VENDORS.csv`.
2. **Import History**: Go to Historical Load -> Change Entity to "Financial Documents" -> Upload `FINANCIAL_DOCS.csv`.
3. **Run Detection Baseline**: Wait for the background worker to process historical matches (Automatic).
4. **Trigger Payment Gate**: Go to Payment Gate -> Upload `PAYMENT_GATE_UPLOAD.csv`.
5. **Verify Outcomes**:
   - Confirm SC-001 triggers an Exact match BLOCK.
   - Confirm SC-003 (Fuzzy) triggers a REVIEW case.
   - Confirm SC-011 (Paid) triggers a RECOVERY case.

## Data Rules:
- Currency: USD, EUR, GBP, GHS, SEK.
- Date Format: YYYY-MM-DD.
- Logical Check: gross_amount = net_amount + tax_amount.
