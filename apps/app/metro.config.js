const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')
const { createRequire } = require('module')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')
const appRequire = createRequire(path.join(projectRoot, 'package.json'))

const config = getDefaultConfig(projectRoot)

// Monorepo: watch shared packages, but resolve deps from the app workspace first so
// hoisted Expo SDK 56 / Metro 0.84 at the repo root cannot override Expo SDK 52.
config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
// Allow nested package deps (e.g. react-native → scheduler) on EAS,
// where monorepo hoisting differs from local installs.
config.resolver.disableHierarchicalLookup = false

// tsc remaps `react` → @types/react (React 18) so it does not pick Next's React 19
// types. Metro must still bundle the real runtime package.
const defaultResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === 'react' ||
    moduleName === 'react/jsx-runtime' ||
    moduleName === 'react/jsx-dev-runtime'
  ) {
    return {
      filePath: appRequire.resolve(moduleName),
      type: 'sourceFile',
    }
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform)
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
