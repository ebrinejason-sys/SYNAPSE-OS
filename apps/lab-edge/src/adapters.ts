import { createHash } from "node:crypto"
import { copyFile, mkdir, readFile, rename, stat } from "node:fs/promises"
import { basename, join } from "node:path"

export type AnalyzerFileFormat = "CSV" | "TXT" | "FIXED_WIDTH"

export type AnalyzerFile = {
  path: string
  name: string
  format: AnalyzerFileFormat
  hash: string
  content: string
}

export type FileImportDirectories = {
  watch: string
  archive: string
  quarantine: string
}

export type FileImportResult =
  | { status: "READY"; file: AnalyzerFile }
  | { status: "QUARANTINED"; path: string; reason: string }

export type Rs232Config = {
  path: string
  baudRate: number
  parity: "none" | "even" | "odd"
  dataBits: 7 | 8
  stopBits: 1 | 2
  flowControl: "none" | "rtscts" | "xonxoff"
  readTimeoutMs: number
}

export interface Rs232Transport {
  open(): Promise<void>
  close(): Promise<void>
  read(timeoutMs?: number): Promise<Buffer>
  write(payload: Buffer | string): Promise<void>
  health(): Promise<{ online: boolean; detail: string }>
}

export type Rs232TransportFactory = (config: Rs232Config) => Rs232Transport

export function fileHash(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}

function formatFor(name: string): AnalyzerFileFormat | null {
  const extension = name.toLowerCase().split(".").pop()
  if (extension === "csv") return "CSV"
  if (extension === "txt") return "TXT"
  if (extension === "dat" || extension === "fw") return "FIXED_WIDTH"
  return null
}

export async function importAnalyzerFile(
  path: string,
  directories: FileImportDirectories,
  isDuplicate: (hash: string) => boolean,
): Promise<FileImportResult> {
  const name = basename(path)
  const format = formatFor(name)
  await Promise.all([
    mkdir(directories.archive, { recursive: true }),
    mkdir(directories.quarantine, { recursive: true }),
  ])
  if (!format) {
    const target = join(directories.quarantine, name)
    await rename(path, target)
    return { status: "QUARANTINED", path: target, reason: "UNSUPPORTED_FILE_FORMAT" }
  }

  const content = await readFile(path, "utf8")
  if (!content.trim()) {
    const target = join(directories.quarantine, name)
    await rename(path, target)
    return { status: "QUARANTINED", path: target, reason: "EMPTY_FILE" }
  }
  const hash = fileHash(content)
  if (isDuplicate(hash)) {
    const target = join(directories.archive, `${hash}-${name}`)
    await rename(path, target)
    return { status: "QUARANTINED", path: target, reason: "DUPLICATE_FILE" }
  }
  return { status: "READY", file: { path, name, format, hash, content } }
}

export async function archiveAnalyzerFile(file: AnalyzerFile, archiveDirectory: string): Promise<string> {
  await mkdir(archiveDirectory, { recursive: true })
  const target = join(archiveDirectory, `${file.hash}-${file.name}`)
  await copyFile(file.path, target)
  return target
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}