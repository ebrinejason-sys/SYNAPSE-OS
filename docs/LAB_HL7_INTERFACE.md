# SYNAPSE Lab HL7 v2 / MLLP Interface

## Transport

HL7 v2 over MLLP: framing, ACK/NACK, message control IDs, deduplication, encoding characters, escape handling.

## Profiles

| Direction | Initial profile |
|-----------|-----------------|
| Inbound | ORU-style laboratory results |
| Outbound | ORM / OML or vendor-documented equivalent (optional) |

Vendor interface manuals are authoritative — do not assume message types.

## Deduplication

Use device ID + message control ID + payload hash + accession + test + run time to prevent duplicate clinical results under at-least-once delivery.
