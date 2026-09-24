// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { assemble } from './assemble.mjs'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const registerAtoms = readFileSync(join(repoRoot, '.github/actions/register-atoms/action.yml'), 'utf8')

function actionStep(name) {
  const start = registerAtoms.indexOf(`    - name: ${name}\n`)
  assert.notEqual(start, -1, `${name} is missing`)
  const end = registerAtoms.indexOf('    - name:', start + 1)
  const section = registerAtoms.slice(start, end < 0 ? undefined : end)
  const run = section.split('      run: |\n')[1]
  return { section, run: run?.split('\n').map((line) => line.replace(/^        /, '')).join('\n') }
}

function writeExecutable(path, contents) {
  writeFileSync(path, contents)
  chmodSync(path, 0o755)
}

function runContributorAtomSubmission(atomContents, { forkExists = true, forkParent = 'Bespok3d/main-index', existingBranch = '' } = {}) {
  const fixture = mkdtempSync(join(tmpdir(), 'register-atoms-'))
  const commands = join(fixture, 'commands')
  const atoms = join(fixture, 'dist')
  const log = join(fixture, 'commands.log')
  const forkMarker = join(fixture, 'fork-exists')
  mkdirSync(commands)
  mkdirSync(atoms)
  writeFileSync(join(atoms, 'widget.atom.json'), atomContents)
  writeFileSync(join(atoms, 'widget.b3'), 'package must not enter the index')
  if (forkExists) writeFileSync(forkMarker, '')
  writeExecutable(join(commands, 'git'), `#!/bin/bash
echo "git $*" >> "$ACTION_LOG"
case "$1" in
  clone) mkdir -p "$5/atoms" ;;
  diff) exit 1 ;;
  ls-remote) if [ -n "$EXISTING_BRANCH" ]; then printf '%s\\t%s\\n' "$EXISTING_BRANCH" "$3"; fi ;;
esac
`)
  writeExecutable(join(commands, 'gh'), `#!/bin/bash
echo "gh $*" >> "$ACTION_LOG"
case "$*" in
  'api user --jq .login') echo sample-publisher ;;
  'api user --jq .id') echo 1234 ;;
  'api repos/sample-publisher/main-index --jq .full_name') test -e "$FORK_MARKER" && echo sample-publisher/main-index ;;
  'api repos/sample-publisher/main-index --jq .parent.full_name') echo "$FORK_PARENT" ;;
  'repo fork Bespok3d/main-index --clone=false --remote=false') touch "$FORK_MARKER" ;;
esac
`)
  writeExecutable(join(commands, 'node'), `#!/bin/bash
echo "assemble $*" >> "$ACTION_LOG"
test "$1" = scripts/assemble.mjs || exit 2
test -f atoms/widget.atom.json || exit 2
test ! -e atoms/widget.b3 || exit 2
grep -q unresolved atoms/widget.atom.json && exit 1
exit 0
`)
  const result = spawnSync('bash', ['-c', actionStep('Submit validated atoms from the contributor fork').run], {
    cwd: fixture,
    env: {
      ...process.env,
      PATH: `${commands}${delimiter}${process.env.PATH}`,
      ACTION_LOG: log,
      FORK_MARKER: forkMarker,
      FORK_PARENT: forkParent,
      EXISTING_BRANCH: existingBranch,
      GH_TOKEN: 'fixture-token',
      B3D_ATOMS_DIR: atoms,
      B3D_BUILDER_CORE_ROOT: fixture,
      GITHUB_REPOSITORY: 'sample-publisher/widgets',
      GITHUB_RUN_ID: '42',
      GITHUB_RUN_ATTEMPT: '1',
    },
    encoding: 'utf8',
  })
  const transcript = readFileSync(log, 'utf8')
  rmSync(fixture, { recursive: true, force: true })
  return { result, transcript }
}

test('direct remains the default and keeps its main push with five rebase attempts', () => {
  assert.match(registerAtoms, /submission:\n(?:.|\n)*?default: direct/)
  const direct = actionStep('Commit the built atoms into the index')
  assert.match(direct.section, /if: inputs\.submission == 'direct'/)
  assert.match(direct.section, /MAIN_INDEX_TOKEN: \$\{\{ inputs\.token \}\}/)
  assert.match(direct.run, /git clone --branch main "https:\/\/x-access-token:\$\{MAIN_INDEX_TOKEN\}@github.com\/Bespok3d\/main-index\.git"/)
  assert.match(direct.run, /for attempt in 1 2 3 4 5; do/)
  assert.match(direct.run, /git pull --rebase --no-edit origin main/)
})

test('submission mode requires only its own token', () => {
  const validation = actionStep('Validate registration mode').run
  const run = (submission, maintainerToken, contributorToken) => spawnSync('bash', ['-c', validation], {
    env: { ...process.env, B3D_SUBMISSION: submission, MAIN_INDEX_TOKEN: maintainerToken, CONTRIBUTOR_TOKEN: contributorToken },
    encoding: 'utf8',
  })
  assert.equal(run('direct', 'maintainer', '').status, 0)
  assert.equal(run('pull-request', '', 'contributor').status, 0)
  assert.match(run('direct', '', '').stderr, /requires token/)
  assert.match(run('pull-request', '', '').stderr, /requires contributor-token/)
  assert.match(run('pull-request', 'maintainer', 'contributor').stderr, /must not receive the upstream token/)
  assert.match(run('other', '', '').stderr, /submission must be/)
})

test('contributor mode validates atoms, pushes only its fork branch, and targets upstream main', () => {
  const contributor = actionStep('Submit validated atoms from the contributor fork')
  assert.match(contributor.section, /if: inputs\.submission == 'pull-request'/)
  assert.match(contributor.section, /GH_TOKEN: \$\{\{ inputs\.contributor-token \}\}/)
  assert.doesNotMatch(contributor.section, /inputs\.token|MAIN_INDEX_TOKEN/)
  assert.match(registerAtoms, /uses: Bespok3d\/b3-builder\/\.github\/actions\/core@[a-f0-9]{40}/)
  const { result, transcript } = runContributorAtomSubmission('{"name":"widget"}')
  assert.equal(result.status, 0, result.stderr)
  assert.match(transcript, /git clone --branch main https:\/\/github.com\/Bespok3d\/main-index\.git/)
  assert.match(transcript, /git switch -c atom-submission\/sample-publisher-widgets-42-1/)
  assert.match(transcript, /git commit -s -m submit atoms from sample-publisher\/widgets/)
  assert.match(transcript, /git restore -- index\.json index\.json\.sig/)
  assert.match(transcript, /git push --force-with-lease=refs\/heads\/atom-submission\/sample-publisher-widgets-42-1: contributor HEAD:refs\/heads\/atom-submission\/sample-publisher-widgets-42-1/)
  assert.match(transcript, /gh api repos\/sample-publisher\/main-index --jq \.parent\.full_name/)
  assert.match(transcript, /gh pr create --repo Bespok3d\/main-index --base main --head sample-publisher:atom-submission\/sample-publisher-widgets-42-1/)
  assert.match(transcript, /--body Generated atoms from sample-publisher\/widgets\. Prospective index assembly passed\./)
  assert.match(transcript, /assemble scripts\/assemble\.mjs/)
  assert.ok(transcript.indexOf('assemble scripts/assemble.mjs') < transcript.indexOf('git push '))
  assert.ok(transcript.indexOf('assemble scripts/assemble.mjs') < transcript.indexOf('git restore -- index.json index.json.sig'))
  assert.ok(transcript.indexOf('assemble scripts/assemble.mjs') < transcript.indexOf('gh pr create'))
  assert.doesNotMatch(transcript, /git push origin|git push .*Bespok3d\/main-index/)
})

test('contributor mode creates an absent fork and refuses an unrelated repository', () => {
  const created = runContributorAtomSubmission('{"name":"widget"}', { forkExists: false })
  assert.equal(created.result.status, 0, created.result.stderr)
  assert.match(created.transcript, /gh repo fork Bespok3d\/main-index --clone=false --remote=false/)
  const unrelated = runContributorAtomSubmission('{"name":"widget"}', { forkParent: 'someone/other-index' })
  assert.notEqual(unrelated.result.status, 0)
  assert.match(unrelated.result.stderr, /is not a fork of Bespok3d\/main-index/)
  assert.doesNotMatch(unrelated.transcript, /git push |gh pr create/)
})

test('a repeated submission reuses only its run branch with a lease', () => {
  const { result, transcript } = runContributorAtomSubmission('{"name":"widget"}', { existingBranch: 'aabbccdd' })
  assert.equal(result.status, 0, result.stderr)
  assert.match(transcript, /git push --force-with-lease=refs\/heads\/atom-submission\/sample-publisher-widgets-42-1:aabbccdd contributor/)
})

test('unresolved service prevents the fork write and PR', () => {
  const unresolvedAtom = { name: 'widget', require: [{ service: 'missing-service', cardinality: 'one' }] }
  assert.throws(() => assemble([unresolvedAtom], []), /missing-service/)
  const { result, transcript } = runContributorAtomSubmission('{"name":"widget","require":[{"service":"unresolved"}]}')
  assert.notEqual(result.status, 0)
  assert.match(transcript, /assemble scripts\/assemble\.mjs/)
  assert.doesNotMatch(transcript, /gh repo fork|git push |gh pr create/)
})
