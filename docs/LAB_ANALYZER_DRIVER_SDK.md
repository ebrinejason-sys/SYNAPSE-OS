# SYNAPSE Lab Analyzer Driver SDK

Drivers implement `AnalyzerDriver` in `apps/lab-edge` (or shared package later).

```ts
interface AnalyzerDriver {
  identify()
  capabilities() // RESULT_UPLOAD | ORDER_DOWNLOAD | HOST_QUERY | …
  connect() / disconnect() / health()
  parseIncoming(raw): NormalizedAnalyzerResult[]
  buildOrderMessage?(…)
  buildHostQueryResponse?(…)
  acknowledge?(ok)
}
```

## Rules

1. Drivers **never** write `lab_results` or release clinical data.  
2. Return normalized messages to the Edge pipeline.  
3. Always retain original raw frame (hash + store) before parse.  
4. Vendor manuals override generic ASTM/HL7 assumptions.  
5. Bidirectional order download is optional per device capabilities.

## Capabilities

| Capability | Meaning |
|------------|---------|
| RESULT_UPLOAD | Unidirectional results to LIS |
| ORDER_DOWNLOAD | LIS pushes assays / sample IDs |
| HOST_QUERY | Analyzer scans barcode and queries LIS |
| QC_UPLOAD | Control results |
| PATIENT_QUERY | Rare; avoid unless vendor requires |

## Simulators (Wave 2+)

- ASTM hematology analyzer  
- HL7 chemistry analyzer  

Must cover: normal, critical, malformed, duplicate, timeout, NAK, wrong accession, unknown code, partial panel, disconnect, recovery.
