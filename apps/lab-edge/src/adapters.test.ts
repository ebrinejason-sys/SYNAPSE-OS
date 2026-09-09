import assert from "node:assert/strict"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"
import { fileExists, importAnalyzerFile, type Rs232Config, type Rs232TransportFactory } from "./adapters.ts"

describe("analyzer adapter boundaries", () => {
  it("hashes and quarantines duplicate or unsupported files", async () => {
    const root = mkdtempSync(join(tmpdir(), "synapse-file-adapter-"))
    const directories = { watch: root, archive: join(root, "archive"), quarantine: join(root, "quarantine") }
    const firstPath = join(root, "results.csv")
    writeFileSync(firstPath, "accession,code,value\nLAB-1,WBC,6.8\n")
    const first = await importAnalyzerFile(firstPath, directories, () => false)
    assert.equal(first.status, "READY")
    if (first.status !== "READY") return

    const duplicatePath = join(root, "results-copy.csv")
    writeFileSync(duplicatePath, first.file.content)
    const duplicate = await importAnalyzerFile(duplicatePath, directories, () => true)
    assert.equal(duplicate.status, "QUARANTINED")
    if (duplicate.status === "QUARANTINED") assert.equal(duplicate.reason, "DUPLICATE_FILE")

    const unsupportedPath = join(root, "results.pdf")
    writeFileSync(unsupportedPath, "not an analyzer result")
    const unsupported = await importAnalyzerFile(unsupportedPath, directories, () => false)
    assert.equal(unsupported.status, "QUARANTINED")
    assert.equal(await fileExists(unsupportedPath), false)
  })

  it("keeps RS-232 as a documented transport boundary without guessing vendor protocol", async () => {
    const config: Rs232Config = {
      path: "/dev/ttyUSB0",
      baudRate: 9600,
      parity: "none",
      dataBits: 8,
      stopBits: 1,
      flowControl: "none",
      readTimeoutMs: 5_000,
    }
    const factory: Rs232TransportFactory = () => ({
      async open() {},
      async close() {},
      async read() { return Buffer.from("") },
      async write() {},
      async health() { return { online: false, detail: "transport_not_configured" } },
    })
    assert.equal(typeof factory(config).open, "function")
    assert.equal((await factory(config).health()).online, false)
    assert.equal(config.baudRate, 9600)
  })
})