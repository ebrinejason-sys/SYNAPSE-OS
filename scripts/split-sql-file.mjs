#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const input = process.argv[2] || join(root, "supabase/bootstrap/canonical_public_schema.sql")
const outDir = process.argv[3] || join(root, ".tmp/fresh-chunks")
const maxBytes = Number(process.argv[4] || 80_000)

function splitSql(sql) {
  const stmts = []
  let buf = ""
  let i = 0
  let dollar = null
  let inSingle = false
  let inDouble = false
  while (i < sql.length) {
    const c = sql[i]
    if (dollar) {
      if (sql.startsWith(dollar, i)) {
        buf += dollar
        i += dollar.length
        dollar = null
        continue
      }
      buf += c
      i += 1
      continue
    }
    if (inSingle) {
      buf += c
      if (c === "'" && sql[i + 1] === "'") {
        buf += sql[i + 1]
        i += 2
        continue
      }
      if (c === "'") inSingle = false
      i += 1
      continue
    }
    if (inDouble) {
      buf += c
      if (c === '"') inDouble = false
      i += 1
      continue
    }
    if (c === "'") {
      inSingle = true
      buf += c
      i += 1
      continue
    }
    if (c === '"') {
      inDouble = true
      buf += c
      i += 1
      continue
    }
    if (c === "$") {
      const match = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/)
      if (match) {
        dollar = match[0]
        buf += match[0]
        i += match[0].length
        continue
      }
    }
    if (c === ";") {
      const statement = buf.trim()
      if (statement) stmts.push(statement)
      buf = ""
      i += 1
      continue
    }
    buf += c
    i += 1
  }
  const tail = buf.trim()
  if (tail) stmts.push(tail)
  return stmts
}

const sql = readFileSync(input, "utf8")
const statements = splitSql(sql)
mkdirSync(outDir, { recursive: true })
const chunks = []
let current = []
let size = 0
for (const statement of statements) {
  const extra = statement.length + 2
  if (current.length && size + extra > maxBytes) {
    chunks.push(current)
    current = []
    size = 0
  }
  current.push(statement)
  size += extra
}
if (current.length) chunks.push(current)

chunks.forEach((chunk, index) => {
  const name = `chunk_${String(index).padStart(3, "0")}.sql`
  writeFileSync(join(outDir, name), `${chunk.join(";\n")};\n`)
})

console.log(JSON.stringify({
  input,
  statements: statements.length,
  chunks: chunks.length,
  outDir,
}, null, 2))
