import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const targets = [
  path.join(root, 'node_modules', '@expo', 'metro-config', 'build', 'file-store.js'),
  path.join(root, 'apps', 'app', 'node_modules', '@expo', 'metro-config', 'build', 'file-store.js'),
]

for (const target of targets) {
  if (!fs.existsSync(target)) continue

  const source = fs.readFileSync(target, 'utf8')
  const broken = `const FileStore_1 = __importDefault(require("metro-cache/src/stores/FileStore"));`
  const fixed = `const { FileStore: MetroFileStore } = require("metro-cache");`

  if (source.includes(broken)) {
    fs.writeFileSync(
      target,
      source
        .replace(broken, fixed)
        .replace('extends FileStore_1.default', 'extends MetroFileStore')
    )
  }
}
