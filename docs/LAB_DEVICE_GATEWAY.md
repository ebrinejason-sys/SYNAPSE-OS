# SYNAPSE Lab Device Gateway

## Role

Lab Edge (`apps/lab-edge`) runs on a laboratory LAN host (Linux service / Docker; Windows service later).

- Opens serial / TCP / MLLP connections to analyzers
- Persists raw frames to a durable local SQLite queue
- Uploads to cloud `POST /api/lab/instrument-ingest` with a scoped bridge credential
- Heartbeats to `POST /api/lab/edge/heartbeat`
- Survives internet loss; retries with idempotent payload hashes

Cloud Lab does **not** maintain direct RS-232 links.

A connected analyzer is **not** automatically trusted clinical truth.

`device → immutable raw data → deterministic parsing → explicit mapping → staging → human validation → canonical lab_results → AI assistance → human verification → release`

## Security

- Unique Edge identity per installation
- Scoped credential bound to tenant + facility + device + ingest/heartbeat
- **Never** place `SUPABASE_SERVICE_ROLE_KEY` on Edge
- Secrets are HMAC-digested (`api_key_hash`) with server-only `LAB_BRIDGE_HASH_SECRET`
- UI returns the credential **prefix** only. The prefix is an identifier, not a credential.
- Never log raw patient analyzer payloads to application logs

### Credential model

| | Legacy (deprecated) | Modern |
|---|---|---|
| `api_key` | plaintext secret | `NULL` |
| `api_key_hash` | `NULL` | HMAC-SHA-256(LAB_BRIDGE_HASH_SECRET, issued token) |
| `api_key_prefix` | unused / optional | display metadata only |

XOR: exactly one of `api_key` / `api_key_hash` is present.

`ref:<deviceId>:<prefix>` is **not** a credential and is rejected.

Legacy plaintext support remains only for rows with `api_key_hash IS NULL`. Rotate those installations onto hashed credentials, then remove the legacy path in a later PR once inventory is zero.

If `LAB_BRIDGE_HASH_SECRET` is missing, modern hashed authentication fails closed (503). It does not fall back to plaintext on hashed rows.

## Tables (cloud)

| Table | Purpose |
|-------|---------|
| `lab_devices` | Analyzer registry + connection metadata |
| `lab_device_messages` | Immutable raw traffic |
| `lab_device_test_mappings` | Analyzer code → catalogue / LOINC |
| `lab_result_staging` | Pre-clinical staging (MATCHED / UNMAPPED / …) |
| `lab_instrument_bridges` | Hashed Lab Edge credentials + heartbeat |

## Connection types

`SERIAL_RS232` · `TCP_CLIENT` · `TCP_SERVER` · `HL7_MLLP` · `ASTM` · `FILE_WATCH` · `CSV_IMPORT` · `REST_HTTP` · `VENDOR_API` · `MANUAL`

Protocol-specific fields live in structured `configuration` (RS-232: port/baud/data bits/parity/stop bits/flow control; TCP/MLLP: host/port/TLS/timeout).

## Validation ladder

`CONFIGURED → CONNECTED → VALIDATION → PILOT → ACTIVE`

Operational failure states: `SUSPENDED`, `ERROR`.

`CONNECTED` means the machine is physically present. It is **not** approved to write clinical results. Ingest is allowed only in `VALIDATION`, `PILOT`, or `ACTIVE`.

## Hospital IT / Lab staff setup

1. Install Lab Edge on a laboratory LAN host (`apps/lab-edge`).
2. Register the installation device at `/lab/instruments` (starts `CONFIGURED`).
3. Issue / rotate the scoped bridge credential. Copy the secret once.
4. Configure serial or TCP/MLLP connection on the Edge host.
5. Send a simulator message (`npm run simulate:astm` / `simulate:hl7`).
6. Map analyzer codes on `/lab/mappings` (human approval).
7. Enter `VALIDATION`: machine results stage only; scientist signs evidence; no automatic patient release.
8. Run parallel verification against manual results.
9. Promote to `PILOT`, then `ACTIVE`.

## Bidirectional ordering

Foundational outbound contract exists (`AnalyzerWorklistOutbound`). This release does **not** claim live bidirectional worklist support for unproven device/protocol combinations.

## Schema parity

Forward migration `20260920220000_lab_device_intelligence.sql` added heartbeat columns and hashed credential fields.
Forward migration `20260920224500_lab_bridge_hashed_credentials.sql` makes `api_key` nullable, enforces credential XOR, unique digest, and clears placeholder `api_key` values on hashed rows.
The large canonical dump still describes the pre-heartbeat bridge shape until the next dump refresh.
