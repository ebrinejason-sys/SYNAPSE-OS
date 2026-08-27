# Platform Control Center

Host: `admin.synapseos.tech` (middleware rewrite to `/platform`). MFA (custom TOTP) is preserved. This is not a clinical EHR and must not dump identifiable patient charts to operators. Event explorer masks patient ids.

## Sections added this milestone

| Route | Purpose |
|---|---|
| `/platform` | Executive strip + existing command center |
| `/platform/registry` | Product/capability manifest |
| `/platform/monitoring` | Honest HTTP / DB probes |
| `/platform/simulation` | Demo tenants + scenario runner |
| `/platform/events` | Correlation explorer |
| `/platform/modules` | Facility × module matrix |
| `/platform/integrations` | Connector status (no fake LIVE national feeds) |
| `/platform/incidents` | Lightweight incident log |
| `/platform/database` | Metadata only — **no SQL console** |
| `/platform/deployments` | SHA / provider adapter state |
| `/platform/mobile` | EAS adapter; NOT CONNECTED until credentials exist |

Missing telemetry is labelled `NOT CONNECTED` / `NOT CONFIGURED` / `NO TELEMETRY`.
