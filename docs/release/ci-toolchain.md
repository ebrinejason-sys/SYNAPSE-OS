# CI / toolchain notes

## ESLint + AJV

Expo/metro need **ajv@8**. `@eslint/eslintrc` (loaded by ESLint 9) needs **ajv@6**. A single hoisted ajv@8 crashes lint:

```text
TypeError: Cannot set properties of undefined (setting 'defaultMeta')
```

Fix:

1. Root devDependency `ajv6` is `npm:ajv@6.12.6`.
2. `scripts/nest-eslint-ajv6.mjs` copies that tree under `@eslint/eslintrc` and `eslint` on `postinstall`.
3. Web and pharmacy ESLint configs use Next's native `flatConfig` (no FlatCompat).
4. Lint scripts actually run `eslint . --max-warnings 0`. They are not `echo` stubs.

## Expo React types

Next (React 19) and Expo (React 18) share the repo. `apps/app/tsconfig.json` remaps `react` to the workspace-local `@types/react@18.3.12` so `tsc` does not pick the hoisted React 19 types.

Hard gates:

`.github/workflows/deploy.yml` no longer uses `continue-on-error` for Expo typecheck or web lint.
Expo Android export is a required CI step. `npm run verify:pharm-release` is the operator/agent
command; it fails the process if any required gate fails and prints `SKIPPED` (never PASS) for
live RLS probes and EAS APK when credentials are absent.

Metro: `apps/app/tsconfig.json` remaps `react` to `@types/react@18` for `tsc`. `metro.config.js`
forces the real `react` runtime so `expo export` does not resolve types packages.
