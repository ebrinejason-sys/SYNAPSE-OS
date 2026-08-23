# GitHub required checks for Pharm release

Vercel success is not the pharmacy release gate.

After `.github/workflows/ci.yml` is on `main`, require these checks on `main`:

1. `CI / verify`
2. `CI / pharm-release`
3. `Vercel – synapse-pharm` (deployment, not release)

Settings path:

GitHub → SYNAPSE-OS → Settings → Rules → Rulesets (or Branches → Branch protection) → `main` → require status checks.

Do not require the old `CI` workflow that failed in 0s. That failure was caused by `secrets.VERCEL_TOKEN` in a job-level `if`, which invalidates the whole workflow.
