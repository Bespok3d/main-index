#!/usr/bin/env bash
# The published index's own gate. main-index carries no application code: it is the assembled index
# plus the scripts that assemble, sign and verify it, so its gate is those scripts' tests plus the
# workspace-wide detectors. Exits non-zero on any failure.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# The detectors that enforce a workspace-wide rule live in one place and are invoked by every repo's
# gate. See lib_bespok3d/tooling/README.md. This is the only line that knows where they are.
B3D_TOOLING="${B3D_TOOLING:-$REPO_ROOT/../lib_bespok3d/tooling}"
# shellcheck source=/dev/null
. "$B3D_TOOLING/gate-lib.sh"

cd "$REPO_ROOT" || exit 1

echo ""
echo "main-index gate"

run_check "assemble"        node --test scripts/assemble.test.mjs
run_check "assemble signing" node --test scripts/assemble-sign.test.mjs
run_check "verify index"    node --test scripts/verify-index.test.mjs
run_check "verify lists"    node --test scripts/verify-lists.test.mjs
run_check "assemble workflow" node --test scripts/assemble-workflow.test.mjs
run_check "register atoms"  node --test scripts/register-atoms-action.test.mjs

workflow_pinning_check "$REPO_ROOT"
# The atoms and lists carry the plugin descriptions users read in the app, so RULE ZERO covers the
# index data, not just the scripts.
em_dash_check "$REPO_ROOT/scripts" "$REPO_ROOT/atoms" "$REPO_ROOT/lists" \
    "$REPO_ROOT/index.json" "$REPO_ROOT/README.md"
shellcheck_repo "$REPO_ROOT/scripts"

gate_summary || exit 1
