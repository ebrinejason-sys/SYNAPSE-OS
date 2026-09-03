# SYNAPSE Lab Device Gateway

## Role

Lab Edge (`apps/lab-edge`) runs on a laboratory LAN host (Linux service / Docker; Windows service later).

- Opens serial / TCP / MLLP connections to analyzers  
- Persists raw frames to a durable local queue (SQLite in production)  
- Uploads to cloud `POST /api/lab/instrument-ingest` with a scoped bridge credential  
- Survives internet loss; retries with idempotent payload hashes  

Cloud Lab does **not** maintain direct RS-232 links.

## Security

- Unique Edge identity per installation  
- Scoped credential / certificate bound to tenant + facility  
- **Never** place Supabase service-role keys on Edge  
- Never log raw patient analyzer payloads to application logs  

## Tables (cloud)

| Table | Purpose |
|-------|---------|
| `lab_devices` | Analyzer registry + connection metadata |
| `lab_device_messages` | Immutable raw traffic |
| `lab_device_test_mappings` | Analyzer code → catalogue / LOINC |
| `lab_result_staging` | Pre-clinical staging (MATCHED / UNMATCHED / …) |
| `lab_instrument_bridges` | Legacy bridge API keys (ingest auth) |

## Connection types

`SERIAL_RS232` · `TCP_CLIENT` · `TCP_SERVER` · `HL7_MLLP` · `ASTM` · `FILE_WATCH` · `CSV_IMPORT` · `REST_HTTP` · `VENDOR_API` · `MANUAL`

Baud/parity/stop bits are per-device configuration — never hardcoded globally.

## Validation ladder

`CONFIGURED → CONNECTED → VALIDATION → PILOT → ACTIVE`

During VALIDATION, analyzer results do not become clinical results until scientist sign-off.
