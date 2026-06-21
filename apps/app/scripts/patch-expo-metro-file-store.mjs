import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = path.join(appRoot, 'node_modules', '@expo', 'metro-config', 'build', 'file-store.js')

if (!fs.existsSync(target)) {
  process.exit(0)
}

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
