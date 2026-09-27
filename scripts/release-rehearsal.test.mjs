// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assembleTiers, importBuilderCore } from './assemble.mjs'
import { registerAtoms } from './register-atoms.mjs'

const workspace = join(dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(join(workspace, 'b3-builder/package.json'))
const { generateKey } = require('openpgp')
const builder = await importBuilderCore(dirname(fileURLToPath(import.meta.url)))
const { verifyPackage } = await import('../../b3-builder/dist/action/verify-package.js')
const { prepareVersion } = await import('../../b3-builder/dist/action/version-only.js')

function networkingGuard() {
  const snapshot = readFileSync(new URL('./fixtures/consumers/networking/tag_version_guard.sh', import.meta.url))
  if (!process.env.B3D_CONSUMER_WORKSPACE) return snapshot
  const actual = readFileSync(join(process.env.B3D_CONSUMER_WORKSPACE, 'plugins/networking/scripts/tag_version_guard.sh'))
  assert.deepEqual(actual, snapshot, 'networking guard snapshot drift')
  return actual
}

function unitSource(root, name, version) {
  const directory = join(root, name)
  mkdirSync(join(directory, 'files'), { recursive: true })
  writeFileSync(join(directory, 'manifest.json'), JSON.stringify({ name, version, publisher: 'PLACEHOLDER', channel: 'stable' }))
  writeFileSync(join(directory, 'files/payload'), `fixture payload for ${name}\n`)
}
function readAtoms(directory) { return readdirSync(directory).map((filename) => JSON.parse(readFileSync(join(directory, filename), 'utf8'))) }

// The package bytes are real builder outputs; release hosting is represented by fixture URLs only.
test('two-plugin consumer builds selected tiers, registers transitions, and serves three signed indexes', async () => {
  const root = mkdtempSync(join(tmpdir(), 'release-rehearsal-'))
  const source = join(root, 'source')
  const output = join(root, 'output')
  const atoms = join(root, 'atoms')
  mkdirSync(join(source, 'scripts'), { recursive: true })
  mkdirSync(atoms)
  writeFileSync(join(source, 'scripts/tag_version_guard.sh'), networkingGuard())
  unitSource(source, 'selected', '1.0.0')
  unitSource(source, 'unrelated', '4.0.0')
  const { privateKey, publicKey } = await generateKey({ type: 'ecc', userIDs: [{ name: 'fixture-only rehearsal' }], format: 'armored' })
  const publisher = await builder.publicKeyFingerprint(publicKey)
  const request = { unit: 'repo', sourceDir: source, outputDir: output, identity: { atomRepo: 'fixture/consumer' }, signingKey: privateKey }
  async function publishFixture(kind, selectedIds) {
    const built = await builder.runPipeline({ ...request, releaseKind: kind, selectedIds })
    for (const entry of built.atoms.filter((entry) => selectedIds.includes(entry.name))) {
      const manifest = await verifyPackage(join(output, `${entry.name}-${entry.version}.b3`), publicKey, true)
      assert.equal(manifest.version, entry.version)
      const finalized = { ...entry, download_url: `https://fixture.invalid/${entry.name}-${entry.version}.b3` }
      writeFileSync(join(output, `${entry.name}.${kind}.atom.json`), JSON.stringify(finalized))
    }
    registerAtoms(output, atoms, kind, selectedIds)
    return assembleTiers(root, readAtoms(atoms), [], publisher, [], privateKey, builder)
  }
  await publishFixture('live', ['selected', 'unrelated'])
  const unrelated = readFileSync(join(atoms, 'unrelated.live.atom.json'))
  const incumbent = readFileSync(join(atoms, 'selected.live.atom.json'))
  unitSource(source, 'selected', '2.0.0-pre')
  execFileSync('sh', ['scripts/tag_version_guard.sh', 'plugin-selected-v2.0.0-pre'], { cwd: source })
  await publishFixture('draft', ['selected'])
  assert.deepEqual(readFileSync(join(atoms, 'selected.live.atom.json')), incumbent)
  const candidate = readFileSync(join(output, 'selected-2.0.0-pre.b3'))
  const draftAtom = JSON.parse(readFileSync(join(output, 'selected.draft.atom.json'), 'utf8'))
  writeFileSync(join(output, 'selected.prerelease.atom.json'), JSON.stringify({ ...draftAtom, release_kind: 'prerelease' }))
  registerAtoms(output, atoms, 'prerelease', ['selected'])
  registerAtoms(output, atoms, 'prerelease', ['selected'])
  assert.deepEqual(readFileSync(join(output, 'selected-2.0.0-pre.b3')), candidate)
  prepareVersion(join(source, 'selected/manifest.json'), '2.0.0-pre')
  execFileSync('sh', ['scripts/tag_version_guard.sh', 'plugin-selected-v2.0.0'], { cwd: source })
  const indexes = await publishFixture('live', ['selected'])
  assert.deepEqual(readFileSync(join(atoms, 'unrelated.live.atom.json')), unrelated)
  assert.equal(indexes['index.json'].plugins.find((entry) => entry.name === 'selected').version, '2.0.0')
  assert.deepEqual(indexes['draft-index.json'].plugins, [])
  assert.equal(indexes['prerelease-index.json'].plugins[0].version, '2.0.0-pre')
  for (const filename of Object.keys(indexes)) assert.equal(await builder.verifyDetached(readFileSync(join(root, filename)), readFileSync(join(root, `${filename}.sig`), 'utf8'), publicKey), true)
  process.stdout.write(`Fixture provenance: selected 1.0.0 -> 2.0.0-pre -> 2.0.0; unrelated 4.0.0 unchanged; publisher ${publisher}; three exact-byte signatures verified\n`)
})
