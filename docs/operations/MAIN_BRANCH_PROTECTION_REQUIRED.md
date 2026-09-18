# Main branch protection — operator action required

**Status:** CURRENT  
**Date:** 2026-09-18  
**Repository:** `ebrinejason-sys/SYNAPSE-OS`

GitHub API historically returns HTTP 403 for classic branch protection and repository rulesets on this private repository on a free personal plan:

> Upgrade to GitHub Pro or make this repository public to enable this feature.

Until that changes, **`main` is not protected**. Direct pushes are an operational incident. Do not claim the branch is protected.

## Preferred fix

1. Move `SYNAPSE-OS` under a GitHub Organization on Team (or upgrade the owner to Pro).
2. Settings → Rules → Rulesets → New branch ruleset.
3. Target: `refs/heads/main`
4. Enable:
   - Require a pull request before merging (0 approvals is acceptable for a solo owner; the point is to block raw pushes)
   - Require status checks to pass: **`required`** (aggregator job in `.github/workflows/ci.yml`). Optionally also `verify`.
   - Require branches to be up to date before merging
   - Block force pushes
   - Block deletions
5. Do **not** allow bypass except a documented break-glass role.

## Verify

```bash
gh api repos/ebrinejason-sys/SYNAPSE-OS/branches/main/protection
gh api repos/ebrinejason-sys/SYNAPSE-OS/rulesets
```

A 200 with required checks including `required` means protection is on. A 403/404 means it is still off.

## Until then

Merge only via PR after `CI / required` is green. Treat any direct `git push origin main` as a release incident.
