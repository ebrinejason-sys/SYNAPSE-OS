# SYNAPSE Lab Machine Validation

A machine integration cannot become **ACTIVE** until:

1. Connection validated  
2. Protocol validated  
3. Test mappings approved  
4. Units approved  
5. Reference ranges approved  
6. QC configured where applicable  
7. Duplicate-message test passes  
8. Wrong-accession / unmatched test passes (no patient assignment)  
9. Offline queue test passes  
10. Sample validation set compared (analyzer native vs Synapse parsed)  
11. Laboratory scientist signs off  

Opening a TCP port alone is **not** READY.

## Validation mode

Analyzer results remain in staging / review only. They must not auto-release.
