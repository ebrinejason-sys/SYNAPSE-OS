# Main branch protection

**Status:** ENABLED (repository ruleset)  
**Date:** 2026-09-18  
**Repository:** `ebrinejason-sys/SYNAPSE-OS`  
**Ruleset:** [Protect main](https://github.com/ebrinejason-sys/SYNAPSE-OS/rules/23649402) (`23649402`)

Classic `/branches/main/protection` still returns 404. Protection is enforced through GitHub rulesets, not the legacy branch-protection API.

## Enforced on `refs/heads/main`

- Require a pull request before merging (0 approvals; extra approval required for unattributed changes)
- Require status checks: **`required`**
- Require branches to be up to date before merging (`strict_required_status_checks_policy`)
- Block force pushes (`non_fast_forward`)
- Block deletions
- No bypass actors

## Verify

```bash
gh api repos/ebrinejason-sys/SYNAPSE-OS/rulesets/23649402
gh api repos/ebrinejason-sys/SYNAPSE-OS/branches/main/protection
```

Ruleset `enforcement: active` with `include: ["refs/heads/main"]` means protection is on. A 404 on the classic protection endpoint is expected.
