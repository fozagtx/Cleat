#!/usr/bin/env bash
# Validate Cleat's maintained documentation and reject retired deployment paths.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
required=(README.md CONTEXT.md REPRODUCIBILITY.md)

for file in "${required[@]}"; do
  [[ -s "$ROOT/$file" ]] || {
    echo "missing required documentation: $file" >&2
    exit 1
  }
done

if rg -i 'phala|HANDOFF\.md|python/|typescript/|SAY_HELLO|SAY_GOODBYE' \
  "$ROOT/README.md" "$ROOT/CONTEXT.md" "$ROOT/REPRODUCIBILITY.md" "$ROOT/go/README.md"; then
  echo "retired architecture reference found" >&2
  exit 1
fi

for term in \
  "GCP Confidential Space" \
  "SIMULATED_TEE=false" \
  "REHYDRATION_ENABLED=true" \
  "PLEDGE_REGISTRY_ADDRESS" \
  "setExtensionId"; do
  rg -q -F "$term" "$ROOT/README.md" "$ROOT/CONTEXT.md" || {
    echo "required deployment invariant missing: $term" >&2
    exit 1
  }
done

echo "Cleat documentation checks passed"
