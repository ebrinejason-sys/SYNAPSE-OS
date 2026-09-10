import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "check-migration-history.mjs")

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "migration-history-test-"))
  run(dir, ["init", "-q"])
  run(dir, ["config", "user.email", "test@example.test"])
  run(dir, ["config", "user.name", "Test"])
  mkdirSync(join(dir, "supabase", "migrations"), { recursive: true })
  return dir
}

function run(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim()
}

function writeMigration(dir, name, sql) {
  writeFileSync(join(dir, "supabase", "migrations", name), sql)
}

function commit(dir, message) {
  run(dir, ["add", "-A"])
  run(dir, ["commit", "-q", "-m", message])
  return run(dir, ["rev-parse", "HEAD"])
}

function runCheck(dir, baselineRef) {
  try {
    const stdout = execFileSync("node", [scriptPath], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, MIGRATION_HISTORY_BASELINE: baselineRef },
    })
    return { exitCode: 0, output: JSON.parse(stdout) }
  } catch (err) {
    return { exitCode: err.status ?? 1, output: JSON.parse(err.stdout) }
  }
}

test("valid additive migration passes with no errors", () => {
  const dir = makeRepo()
  try {
    writeMigration(dir, "20260101000000_init.sql", "create table demo (id uuid primary key);")
    const baseline = commit(dir, "baseline")
    writeMigration(dir, "20260102000000_add_column.sql", "alter table demo add column name text;")
    commit(dir, "additive")

    const { exitCode, output } = runCheck(dir, baseline)
    assert.equal(exitCode, 0)
    assert.deepEqual(output.errors, [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("fails on historical migration modified after baseline", () => {
  const dir = makeRepo()
  try {
    writeMigration(dir, "20260101000000_init.sql", "create table demo (id uuid primary key);")
    const baseline = commit(dir, "baseline")
    writeMigration(dir, "20260101000000_init.sql", "create table demo (id uuid primary key, extra text);")
    commit(dir, "tampered")

    const { exitCode, output } = runCheck(dir, baseline)
    assert.equal(exitCode, 1)
    assert.ok(output.errors.some((e) => e.includes("modified since")), JSON.stringify(output.errors))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("fails on deleted historical migration file", () => {
  const dir = makeRepo()
  try {
    writeMigration(dir, "20260101000000_init.sql", "create table demo (id uuid primary key);")
    writeMigration(dir, "20260102000000_more.sql", "alter table demo add column name text;")
    const baseline = commit(dir, "baseline")
    execFileSync("git", ["rm", "-q", "supabase/migrations/20260102000000_more.sql"], { cwd: dir })
    commit(dir, "delete historical file")

    const { exitCode, output } = runCheck(dir, baseline)
    assert.equal(exitCode, 1)
    assert.ok(output.errors.some((e) => e.includes("deleted since")), JSON.stringify(output.errors))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("fails on duplicate migration version prefix", () => {
  const dir = makeRepo()
  try {
    writeMigration(dir, "20260101000000_init.sql", "create table demo (id uuid primary key);")
    writeMigration(dir, "20260101000000_dup.sql", "create table other (id uuid primary key);")
    const baseline = commit(dir, "baseline")

    const { exitCode, output } = runCheck(dir, baseline)
    assert.equal(exitCode, 1)
    assert.ok(output.errors.some((e) => e.includes("duplicate migration version")), JSON.stringify(output.errors))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("fails closed when the baseline ref cannot be resolved (e.g. shallow clone)", () => {
  const dir = makeRepo()
  try {
    writeMigration(dir, "20260101000000_init.sql", "create table demo (id uuid primary key);")
    commit(dir, "only commit")

    const { exitCode, output } = runCheck(dir, "0000000000000000000000000000000000000000")
    assert.equal(exitCode, 1)
    assert.ok(output.errors.some((e) => e.includes("could not be resolved")), JSON.stringify(output.errors))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("legacy filename exception does not fail as unclassified", () => {
  const dir = makeRepo()
  try {
    writeMigration(dir, "demo_schema_init.sql", "create table demo (id uuid primary key);")
    const baseline = commit(dir, "baseline")

    const { exitCode, output } = runCheck(dir, baseline)
    assert.equal(exitCode, 0)
    assert.ok(!output.errors.some((e) => e.includes("unclassified")), JSON.stringify(output.errors))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
