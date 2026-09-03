/**
 * Minimal CLI entry for Lab Edge scaffold.
 * Production: systemd / Docker with SQLite queue + device drivers.
 */
import { createEdgeRuntime, LAB_EDGE_VERSION } from "./index.ts"

const runtime = createEdgeRuntime()
console.log(
  JSON.stringify(
    {
      service: "synapse-lab-edge",
      version: LAB_EDGE_VERSION,
      status: "scaffold",
      note: "Wave 2: attach ASTM/HL7 drivers; upload to /api/lab/instrument-ingest with bridge key",
      pendingQueue: runtime.queue.pending().length,
    },
    null,
    2,
  ),
)
