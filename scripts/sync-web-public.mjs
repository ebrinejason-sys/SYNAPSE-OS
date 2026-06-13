import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const source = join(root, 'apps', 'web', 'public')
const target = join(root, 'public')

if (!existsSync(source)) {
  console.warn(`[sync-web-public] missing source directory: ${source}`)
  process.exit(0)
}

mkdirSync(target, { recursive: true })
cpSync(source, target, { recursive: true, force: true })
console.log('[sync-web-public] copied apps/web/public -> public')
