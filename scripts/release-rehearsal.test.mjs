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
import { assembleSignedIndex, importBuilderCore } from './assemble.mjs'
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
test('two-plugin consumer replaces the selected dev atom before promoting only that unit on main', async () => {
  const root = mkdtempSync(join(tmpdir(), 'release-rehearsal-'))
  const source = join(root, 'source')
  const output = join(root, 'output')
  const devAtoms = join(root, 'dev-atoms')
  const mainAtoms = join(root, 'main-atoms')
  const devIndex = join(root, 'dev-index')
  const mainIndex = join(root, 'main-index')
  mkdirSync(join(source, 'scripts'), { recursive: true })
  ;[devAtoms, mainAtoms, devIndex, mainIndex].forEach((directory) => mkdirSync(directory))
  writeFileSync(join(source, 'scripts/tag_version_guard.sh'), networkingGuard())
  unitSource(source, 'selected', '1.0.0')
  unitSource(source, 'unrelated', '4.0.0')
  const { privateKey, publicKey } = await generateKey({ type: 'ecc', userIDs: [{ name: 'fixture-only rehearsal' }], format: 'armored' })
  const publisher = await builder.publicKeyFingerprint(publicKey)
  const request = { unit: 'repo', sourceDir: source, outputDir: output, identity: { atomRepo: 'fixture/consumer' }, signingKey: privateKey }
  async function publishFixture(kind, selectedIds, branchAtoms, indexDirectory) {
    const built = await builder.runPipeline({ ...request, releaseKind: kind, selectedIds })
    for (const entry of built.atoms.filter((entry) => selectedIds.includes(entry.name))) {
      const manifest = await verifyPackage(join(output, `${entry.name}-${entry.version}.b3`), publicKey, true)
      assert.equal(manifest.version, entry.version)
      const finalized = { ...entry, download_url: `https://fixture.invalid/${entry.name}-${entry.version}.b3` }
      writeFileSync(join(output, `${entry.name}.${kind}.atom.json`), JSON.stringify(finalized))
    }
    registerAtoms(output, branchAtoms, kind, selectedIds)
    return assembleSignedIndex(indexDirectory, readAtoms(branchAtoms), [], publisher, [], privateKey, builder)
  }
  await publishFixture('live', ['selected', 'unrelated'], mainAtoms, mainIndex)
  const unrelated = readFileSync(join(mainAtoms, 'unrelated.atom.json'))
  const incumbent = readFileSync(join(mainAtoms, 'selected.atom.json'))
  writeFileSync(join(devAtoms, 'selected.atom.json'), incumbent)
  writeFileSync(join(devAtoms, 'unrelated.atom.json'), unrelated)
  unitSource(source, 'selected', '2.0.0-pre')
  execFileSync('sh', ['scripts/tag_version_guard.sh', 'plugin-selected-v2.0.0-pre'], { cwd: source })
  const draftIndex = await publishFixture('draft', ['selected'], devAtoms, devIndex)
  assert.equal(draftIndex.plugins.find((entry) => entry.name === 'selected').version, '2.0.0-pre')
  assert.deepEqual(readFileSync(join(mainAtoms, 'selected.atom.json')), incumbent)
  const candidate = readFileSync(join(output, 'selected-2.0.0-pre.b3'))
  const draftAtom = JSON.parse(readFileSync(join(output, 'selected.draft.atom.json'), 'utf8'))
  writeFileSync(join(output, 'selected.prerelease.atom.json'), JSON.stringify({ ...draftAtom, release_kind: 'prerelease' }))
  registerAtoms(output, devAtoms, 'prerelease', ['selected'])
  registerAtoms(output, devAtoms, 'prerelease', ['selected'])
  assert.deepEqual(readFileSync(join(output, 'selected-2.0.0-pre.b3')), candidate)
  prepareVersion(join(source, 'selected/manifest.json'), '2.0.0-pre')
  execFileSync('sh', ['scripts/tag_version_guard.sh', 'plugin-selected-v2.0.0'], { cwd: source })
  const liveIndex = await publishFixture('live', ['selected'], mainAtoms, mainIndex)
  const candidateIndex = await assembleSignedIndex(devIndex, readAtoms(devAtoms), [], publisher, [], privateKey, builder)
  assert.deepEqual(readFileSync(join(mainAtoms, 'unrelated.atom.json')), unrelated)
  assert.equal(liveIndex.plugins.find((entry) => entry.name === 'selected').version, '2.0.0')
  assert.equal(candidateIndex.plugins.find((entry) => entry.name === 'selected').version, '2.0.0-pre')
  assert.deepEqual(liveIndex.plugins.map((entry) => entry.name), candidateIndex.plugins.map((entry) => entry.name))
  for (const directory of [devIndex, mainIndex]) {
    assert.equal(await builder.verifyDetached(readFileSync(join(directory, 'index.json')), readFileSync(join(directory, 'index.json.sig'), 'utf8'), publicKey), true)
  }
  process.stdout.write(`Fixture provenance: dev selected 2.0.0-pre, main selected 2.0.0; unrelated 4.0.0 unchanged; publisher ${publisher}; both exact-byte signatures verified\n`)
})
