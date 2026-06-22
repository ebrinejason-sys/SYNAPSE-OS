# Synapse Mobile App

Expo SDK 52 · React Native · expo-router

Native client for Synapse Health — role-aware dashboards for patients, clinical staff, and pharmacy teams. Authenticates against `https://www.synapseos.tech` with password + email OTP.

## Quick start

```bash
# From repo root
npm install
npm run start --workspace @synapse/app

# Verify
npm run type-check --workspace @synapse/app
npm run export:android --workspace @synapse/app
```

## Build APK (EAS)

```bash
git push origin main
cd apps/app
npx eas-cli build --platform android --profile preview --non-interactive
```

## Full documentation

See **[GUIDE.md](./GUIDE.md)** for architecture, auth flow, role journeys, design system, API endpoints, troubleshooting, and release checklist.

## Key config

| File | Purpose |
|---|---|
| `app.json` | `extra.webAppUrl` → **must be `https://www.synapseos.tech`** |
| `eas.json` | Build profiles (`preview` = APK) |
| `lib/navigation.ts` | Role → tab mapping |
| `lib/theme.ts` | Design tokens |
