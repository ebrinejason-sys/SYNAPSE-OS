# Synapse Mobile App (Expo)

React Native client for SynapseOS staff and patient workflows. Authenticates against the web API at `https://synapseos.tech` using mobile OTP login.

## Prerequisites

- Node.js 20+
- [Expo CLI / EAS CLI](https://docs.expo.dev/build/setup/) for cloud APK builds
- Android Studio (optional, for local `expo run:android`)

## Development

From the repo root:

```bash
npm install
npm run start --workspace @synapse/app
```

Or from this directory:

```bash
npm start
```

Scan the QR code with Expo Go, or press `a` for an Android emulator.

## Verify bundle

```bash
npm run type-check --workspace @synapse/app
npm run export:android --workspace @synapse/app
```

## Build APK (EAS)

The project is linked to EAS (`owner: ebrinejason`, project ID in `app.json`).

1. Log in: `eas login`
2. Build preview APK:

```bash
npm run build:apk
```

The `preview` profile in `eas.json` produces an installable APK for internal distribution.

To publish under the `synapseos` Expo organization instead, transfer the project in the Expo dashboard or set `"owner": "synapseos"` once you have org access.

## API surface

The app calls these web routes (Bearer token after OTP login):

- `POST /api/auth/mobile/login`
- `POST /api/auth/mobile/otp-verify`
- `GET /api/auth/mobile/me`
- `GET /api/mobile/dashboard`
- `GET /api/mobile/patients`

Configure the API base URL in `app.json` → `expo.extra.webAppUrl`.
