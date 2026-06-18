#!/usr/bin/env bash
# Vercel Ignored Build Step: exit 0 = skip deploy, exit 1 = proceed.
# Runs the same verify as CI before allowing a Git-triggered Vercel build.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[vercel-build-gate] Running verify:web..."
if npm run verify:web; then
  echo "[vercel-build-gate] Verify passed — proceeding with Vercel build."
  exit 1
fi

echo "[vercel-build-gate] Verify failed — skipping Vercel build."
exit 0
