import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const workflowsDir = join(root, ".github", "workflows")
const mutationPattern = /(?:supabase\s+db\s+push|npm\s+run\s+db:push|npm\s+run\s+db:reset)/i
const automaticTriggerPattern = /^\s{2}(push|pull_request|workflow_run):/m
const allowedManualWorkflow = ".github/workflows/db-production.yml"

function filesUnder(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? filesUnder(path) : [path]
  })
}

const violations = []
for (const file of filesUnder(workflowsDir).filter((path) => /\.ya?ml$/.test(path))) {
  const relative = file.slice(root.length + 1)
  const source = readFileSync(file, "utf8")
  if (relative !== allowedManualWorkflow && automaticTriggerPattern.test(source) && mutationPattern.test(source)) {
    violations.push(`${relative}: production mutation is reachable from an automatic trigger`)
  }
}

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
for (const [name, command] of Object.entries(packageJson.scripts ?? {})) {
  if (mutationPattern.test(String(command))) {
    violations.push(`package.json script ${name}: production mutation command must not be an automatic script`)
  }
}

for (const file of filesUnder(join(root, "scripts")).filter((path) => /\.(mjs|js|ts)$/.test(path))) {
  const source = readFileSync(file, "utf8")
  if (mutationPattern.test(source)) {
    violations.push(`${file.slice(root.length + 1)}: production mutation command must remain in an explicit operator workflow`)
  }
}

if (violations.length > 0) {
  console.error("[workflow-safety] violations detected")
  for (const violation of violations) console.error(`- ${violation}`)
  process.exit(1)
}

console.log("[workflow-safety] automatic workflows and referenced scripts are mutation-free")