# Synapse Pharm backup and recovery

## Supabase

- Project: `qfqakzmjatszisuqjwon` (SYNAPSE_OS).
- Use the platform daily backup / PITR available on the current plan.
- Restore expectation: restore to a **new** project or branch first; never overwrite production to “try” a restore.
- Failed migration rollback: each additive migration documents a manual reverse (drop function / drop column). Do not edit already-applied SQL in place.

## Offline device

- Lost or replaced device: treat local SQLite as untrusted. Do not copy `synapse-sync-v1.db` between phones.
- The AES-GCM key lives in SecureStore (`synapse_offline_aes_v1`) and cannot be recovered from the APK.
- Stuck SyncCommand: open Sync status. `queued` may retry. `conflict` / `human_review` requires a pharmacist. Do not delete and recreate the same business sale with a new commandId.
- Device replacement: log in online, refresh catalogue, open a new till. Pending commands on the old device stay on that device.

## Token rotation

If an Expo access token was pasted into chat or a ticket, rotate it at https://expo.dev/settings/access-tokens and store the replacement only in Cursor Cloud secrets / GitHub Actions `EXPO_TOKEN`.
