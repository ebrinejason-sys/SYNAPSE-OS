# EAS build failure — 2026-08-03

## Root cause
`npx expo config` (required by EAS) crashed:

```text
Error: Cannot find module 'ajv/dist/compile/codegen'
```

Monorepo had hoisted **ajv@6** while **ajv-keywords@5** (via `schema-utils` → `expo-router` config plugin) needs **ajv@8**.

## Fix applied (not committed)
1. Root `package.json` overrides: `ajv@^8.17.1`, `@types/react@18.3.12`, `react-native@0.76.9`
2. `npm install` → ajv **8.20.0**; `expo config` succeeds
3. Added missing Expo config plugins: `expo-secure-store`, `expo-font`, `expo-local-authentication`, `expo-notifications`

## Retry
From `apps/app` (logged into Expo):

```bash
npx eas-cli login
npm run build:apk
# or: npx eas-cli build --platform android --profile preview --non-interactive
```

Paste the Expo build URL / log snippet if it still fails after this fix.
