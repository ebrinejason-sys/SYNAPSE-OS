# Release control (Hospital Pilot RC1)

## Current SHA alignment
- GitHub `main`: update via `git rev-parse HEAD` after pull
- Evidence journeys and CI must cite the SHA they ran against
- Admin should eventually show: GitHub main SHA → Vercel deployed SHA → remote migration ledger head

## Branch protection — BLOCKED on this repo today
GitHub API returns HTTP 403 for both classic branch protection and repository rulesets:

> Upgrade to GitHub Pro or make this repository public to enable this feature.

`SYNAPSE-OS` is private on a free personal account, so **required status checks cannot be enforced** even though CI already has a `required` aggregator job (`.github/workflows/ci.yml`).

### P0 options
1. **Preferred:** upgrade the owning GitHub account/org to Pro/Team and enable a ruleset on `main` requiring contexts `required` (and ideally `verify`).
2. Make the repo public (not appropriate for a health platform with private ops).
3. Move the repo under a GitHub Organization with rulesets enabled.

Until that lands, treat direct pushes to `main` as an operational incident. Prefer PR → green CI → merge only.

### Target ruleset (once Pro/Team is available)
- Target: `refs/heads/main`
- Require pull request (0 approvals acceptable for solo owner; still blocks raw push)
- Required status checks (strict): `required`
- No force pushes / no deletions

## CI aggregator
The `required` job in `CI` already fails closed if `verify` is not success. That is the check to require once GitHub allows it.
