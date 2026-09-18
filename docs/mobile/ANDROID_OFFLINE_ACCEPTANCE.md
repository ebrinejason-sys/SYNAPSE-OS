# Android Offline Acceptance Testing

**Status:** Documentation placeholder for GROK Demo Green workstream  
**Owner:** Mobile team  
**Last Updated:** 2026-09-18

## Purpose

This document outlines the offline testing strategy for the SYNAPSE mobile app (Expo React Native) to ensure reliable operation in low-connectivity environments common in healthcare facilities across Uganda.

## Test Categories

### 1. Offline Store Tests
**Location:** `apps/app/__tests__/offline-store.test.ts`

Test the offline-first data layer:
- ✅ Create records while offline
- ✅ Queue mutations in outbox
- ✅ Sync when online
- ✅ Handle conflicts on sync
- ✅ Persist across app restarts

### 2. Sync Outbox Tests
**Location:** `apps/app/__tests__/sync-outbox.test.ts`

Test mutation queueing and replay:
- ✅ Queue operations in correct order
- ✅ Batch sync when reconnected
- ✅ Retry failed syncs with exponential backoff
- ✅ Handle partial sync failures
- ✅ Maintain referential integrity

### 3. Auth/Session Tests
**Location:** `apps/app/__tests__/auth-session.test.ts`

Test authentication persistence:
- ✅ Token refresh while offline
- ✅ Session recovery on app restart
- ✅ Logout while offline
- ✅ Multi-device session handling
- ✅ Secure storage of credentials

### 4. Role/Navigation Tests
**Location:** `apps/app/__tests__/role-navigation.test.ts`

Test role-based access:
- ✅ RBAC enforcement offline
- ✅ Navigation guards per role
- ✅ Feature flags per role
- ✅ Facility context switching
- ✅ Proper fallbacks for unauthorized access

## Mobile App Screen Audit

### Screen Status Legend
- 🟢 **WORKING**: Fully functional, tested offline
- 🟡 **READ_ONLY**: Displays data, no mutations
- 🟠 **PARTIAL**: Some features work, others need work
- 🔴 **PLACEHOLDER**: Stub only, not functional
- ⚫ **REMOVED**: Intentionally removed from navigation

### Audited Screens

#### Core Clinical Workflows
- 🟢 **Patient Registration** - Offline create with local ID
- 🟢 **Vitals Entry** - Queues to outbox
- 🟢 **Clinical Notes** - Draft save offline, sync later
- 🟠 **Lab Orders** - Create offline, limited validation
- 🟠 **Prescriptions** - Create offline, inventory check pending
- 🟡 **Lab Results** - Read-only view, no offline entry

#### Pharmacy
- 🟢 **Dispensing Queue** - Works offline with FEFO
- 🟢 **Inventory Check** - Cached inventory, manual refresh
- 🟠 **POS** - Basic offline, payment validation pending
- 🔴 **Tally Import** - Desktop-only feature

#### Support Screens
- 🟢 **Dashboard** - Works with cached data
- 🟢 **Patient Search** - Local search on cached patients
- 🟡 **Timeline** - Read-only from cache
- 🟠 **Settings** - Profile edit queued, others read-only
- ⚫ **Advanced Reports** - Removed from mobile (desktop only)

## Offline Checkout Intentional Failure

**Important:** The web app intentionally **fails closed** when offline in sensitive workflows:

- ❌ **Pharmacy web checkout**: Disabled offline (inventory validation required)
- ❌ **Billing payment**: Disabled offline (financial transaction integrity)
- ❌ **User management**: Disabled offline (security requirement)

Mobile app handles these differently with proper queueing and conflict resolution.

## Test Execution

### Unit Tests
```bash
cd apps/app
npm test
```

### Integration Tests (requires Metro)
```bash
cd apps/app
npm start
# In another terminal:
npm run test:integration
```

### Manual Acceptance Tests

1. **Offline Create Flow**
   - Disable network
   - Create patient
   - Record vitals
   - Start encounter
   - Enable network
   - Verify sync

2. **Offline Edit Flow**
   - Load patient while online
   - Disable network
   - Edit clinical note
   - Enable network
   - Verify conflict resolution

3. **Multi-Device Sync**
   - Edit same record on two devices offline
   - Enable network on both
   - Verify last-write-wins or merge strategy

4. **App Restart**
   - Create records offline
   - Force quit app
   - Reopen app (still offline)
   - Verify records persist
   - Enable network
   - Verify sync

## Known Issues & Workarounds

### Issue 1: Large Offline Queue
**Symptom:** App freezes during initial sync after long offline period  
**Workaround:** Batch sync in chunks of 50 mutations  
**Fix:** Scheduled for RC1

### Issue 2: Image Attachments
**Symptom:** Photos attached offline don't upload  
**Workaround:** Store images in separate queue  
**Fix:** Implemented in v0.9.8

### Issue 3: Conflict UI
**Symptom:** User not notified of sync conflicts  
**Workaround:** Silent last-write-wins  
**Fix:** UI for manual resolution in backlog

## Testing Tools

### Network Simulation
Use React Native Debugger network panel:
- Simulate 2G, 3G, 4G speeds
- Toggle offline mode
- Throttle bandwidth

### Expo Dev Tools
- View async storage
- Inspect SQLite DB
- Monitor outbox queue
- Force sync trigger

### Physical Device Testing
**Critical:** Always test on real devices with actual network conditions:
- Kampala suburbs (spotty 3G)
- Rural clinics (2G only)
- Hospital basements (Wi-Fi only)
- Market areas (congested 4G)

## Acceptance Criteria

Before marking mobile offline support as "PASS":

- ✅ All core clinical workflows (register, vitals, notes) work offline
- ✅ Outbox queues mutations correctly
- ✅ Sync completes successfully when reconnected
- ✅ No data loss during offline→online transition
- ✅ App doesn't crash after 24h offline
- ✅ Conflict resolution is deterministic
- ✅ User sees clear offline/online indicators
- ✅ Battery drain is acceptable (<10% per hour active use)
- ⏳ Pharmacy POS offline validation (pending)
- ⏳ Image attachment upload (pending)

## Future Enhancements

1. **P2P Sync**: Device-to-device sync via Bluetooth/Wi-Fi Direct
2. **Smart Prefetch**: Predict which data user will need based on schedule
3. **Differential Sync**: Only sync changed fields, not entire records
4. **Background Sync**: Sync in background when on Wi-Fi
5. **Offline AI**: Run clinical decision support models locally

---

**Note:** This is a living document. Update as mobile offline capabilities evolve.

## Related Documentation
- `docs/mobile/REACT_NATIVE_SETUP.md` - Mobile development setup
- `docs/mobile/OFFLINE_ARCHITECTURE.md` - Technical offline architecture
- `apps/app/README.md` - Mobile app overview
- `packages/db/src/memory-sync-outbox-store.test.ts` - Outbox store tests
