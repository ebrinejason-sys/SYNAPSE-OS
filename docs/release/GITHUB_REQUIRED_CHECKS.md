# GitHub required checks for SYNAPSE Pharm

Vercel Git integration success is **not** the pharmacy release gate.

After this workflow lands on `main`, set branch protection required checks to:

- `CI / verify`
- `CI / pharm-release`

Do not require the optional `Deploy` workflow. That job is CLI deploy / db-push only.

## Why Actions looked missing on recent main SHAs

`.github/workflows/deploy.yml` was named `CI` and used `secrets.VERCEL_TOKEN` in a **job-level `if`**. GitHub rejects that pattern and records a 0-second failure with **no jobs**, so the commit status UI showed only Vercel.

`ci.yml` now publishes the real checks. `deploy.yml` is renamed `Deploy` and never tests secrets in `if`.
