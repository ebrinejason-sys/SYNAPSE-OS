/**
 * Lab Edge local queue status entrypoint.
 */
import {
  buildAstmCbcSimulatorMessage,
  buildHl7ChemistrySimulatorMessage,
  createEdgeRuntime,
  EdgeService,
  LAB_EDGE_VERSION,
  sendSimulatorMessage,
} from "./index.ts"

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value] = arg.replace(/^--/, "").split("=")
  return [key, value ?? "true"]
}))
const runtime = createEdgeRuntime()
const command = process.argv[2]

if (command === "simulate:astm" || command === "simulate:hl7") {
  const accession = args.get("accession")
  if (!accession) throw new Error("--accession is required")
  await sendSimulatorMessage(args.get("host") ?? "127.0.0.1", Number(args.get("port") ?? 9100), command.endsWith("astm") ? buildAstmCbcSimulatorMessage(accession) : buildHl7ChemistrySimulatorMessage(accession), command.endsWith("astm") ? "ASTM" : "HL7_MLLP")
  process.exit(0)
}

const service = new EdgeService(runtime.queue, {
  host: args.get("host") ?? "127.0.0.1",
  port: Number(args.get("port") ?? 9100),
  deviceId: args.get("device") ?? "simulator",
  bridgeId: args.get("bridge"),
  protocol: (args.get("protocol") ?? "ASTM") as "ASTM" | "HL7_MLLP",
}, args.get("endpoint") ?? "http://127.0.0.1:3000/api/lab/instrument-ingest", args.get("bridge") ?? "")
await service.start()
process.stdout.write(`${JSON.stringify({ service: "synapse-lab-edge", version: LAB_EDGE_VERSION, state: service.state, queue: runtime.queue.counts() })}\n`)
const shutdown = () => { void service.stop().then(() => process.exit(0)) }
process.once("SIGINT", shutdown)
process.once("SIGTERM", shutdown)
console.log(
  JSON.stringify(
    {
      service: "synapse-lab-edge",
      version: LAB_EDGE_VERSION,
      status: "ready",
      pendingQueue: runtime.queue.pending().length,
      queue: runtime.queue.counts(),
    },
    null,
    2,
  ),
)
