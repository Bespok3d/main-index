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

function pushBranches() {
  const match = workflow.match(/^\s*branches:\s*\[([^\]]*)\]/m)
  assert.ok(match, 'assemble.yml declares no push branches')

  return match[1].split(',').map((branch) => branch.trim())
}

test('assembly watches both the default branch the app reads and main', () => {
  const branches = pushBranches()
  assert.ok(branches.includes('dev'), 'atoms land on dev, so assembly must run there or index.json goes stale')
  assert.ok(branches.includes('main'), 'main must keep assembling too')
})

test('a rejected push resyncs to the branch being assembled, not a hardcoded main', () => {
  assert.match(workflow, /git reset --hard "origin\/\$GITHUB_REF_NAME"/)
  assert.doesNotMatch(workflow, /git reset --hard origin\/main/)
})
