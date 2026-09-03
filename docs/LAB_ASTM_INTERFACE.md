# SYNAPSE Lab ASTM Interface

Generic ASTM-style transport for laboratory analyzers.

## Framing / control

Configurable handling for: ENQ, ACK, NAK, EOT, STX, ETX, ETB, frame number, checksum, CR/LF, timeouts, retries.

## Logical records

Header · Patient · Order · Result · Comment · Terminator

## Implementation notes

- Store **raw frame** before parse (`lab_device_messages`).  
- Vendor profiles override framing and record layouts.  
- Do not assume identical ASTM across manufacturers.  
- Driver returns normalized results to staging; Core performs match by accession only.
