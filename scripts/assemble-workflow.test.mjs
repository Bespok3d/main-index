// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The assembly workflow is the only thing that turns updated atoms into the index.json the app reads,
// so the two ways it can silently stop doing that are guarded here rather than discovered as a 404 in
// the store: watching a branch the atoms never land on, and resyncing a rejected push to a hardcoded
// branch that is not the one being assembled.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const workflow = readFileSync(join(repoRoot, '.github/workflows/assemble.yml'), 'utf-8')
const registerAtoms = readFileSync(join(repoRoot, '.github/actions/register-atoms/action.yml'), 'utf-8')
const prospectiveWorkflow = readFileSync(join(repoRoot, '.github/workflows/pr-assemble.yml'), 'utf-8')

function pushBranches() {
  const match = workflow.match(/^\s*branches:\s*\[([^\]]*)\]/m)
  assert.ok(match, 'assemble.yml declares no push branches')

  return match[1].split(',').map((branch) => branch.trim())
}

// The branch a plugin's release job puts its atom on, read off the action that puts it there, so the
// two halves of one mechanism cannot drift apart: teaching register-atoms a different branch without
// teaching assembly the same one is what leaves index.json frozen while atoms keep arriving.
function atomLandingBranch() {
  const match = registerAtoms.match(/git clone --branch (\S+)/)
  assert.ok(match, 'register-atoms clones without naming a branch')

  return match[1]
}

test('assembly watches exactly the branch atoms land on', () => {
  assert.deepEqual(pushBranches(), [atomLandingBranch()])
})

test('a rejected push resyncs to the branch being assembled, not a hardcoded main', () => {
  assert.match(workflow, /git reset --hard "origin\/\$GITHUB_REF_NAME"/)
  assert.doesNotMatch(workflow, /git reset --hard origin\/main/)
})

test('main-targeted pull requests assemble the prospective index without secrets or publication', () => {
  assert.match(prospectiveWorkflow, /pull_request:\n\s+branches: \[main\]/)
  assert.match(prospectiveWorkflow, /permissions:\n\s+contents: read/)
  assert.match(prospectiveWorkflow, /uses: Bespok3d\/b3-builder\/\.github\/actions\/core@[a-f0-9]{40}/)
  const pinnedCore = /uses: Bespok3d\/b3-builder\/\.github\/actions\/core@([a-f0-9]{40})/
  assert.equal(prospectiveWorkflow.match(pinnedCore)[1], workflow.match(pinnedCore)[1])
  assert.equal(registerAtoms.match(pinnedCore)[1], workflow.match(pinnedCore)[1])
  assert.match(prospectiveWorkflow, /ln -sfn "\$\{\{ steps\.builder-core\.outputs\.core-root \}\}" b3-builder/)
  assert.match(prospectiveWorkflow, /working-directory: main-index\n\s+run: env -u REGISTRY_SIGNING_KEY node scripts\/assemble\.mjs/)
  assert.doesNotMatch(prospectiveWorkflow, /secrets\.|contributor-token|gh pr create|git push|verify-index|REGISTRY_SIGNING_KEY: \$\{\{/)
})
