// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { assembleSignedIndex, importBuilderCore } from './assemble.mjs'
import { registerAtoms } from './register-atoms.mjs'

const require = createRequire(new URL('../../b3-builder/package.json', import.meta.url))
const { generateKey } = require('openpgp')
const builder = await importBuilderCore(new URL('.', import.meta.url).pathname)

function atom(name, version, releaseKind) {
  return { name, version, publisher: 'fixture', download_url: `https://fixture.invalid/${name}-${version}.b3`, ...(releaseKind ? { release_kind: releaseKind } : {}) }
}

function atomAt(directory, name) {
  return JSON.parse(readFileSync(join(directory, `${name}.atom.json`), 'utf8'))
}

function stageAtom(directory, entry) {
  writeFileSync(join(directory, `${entry.name}.${entry.release_kind}.atom.json`), JSON.stringify(entry))
}

test('candidate registration replaces only the selected dev atom while main and unrelated units stay intact', () => {
  const source = mkdtempSync(join(tmpdir(), 'atom-source-'))
  const dev = mkdtempSync(join(tmpdir(), 'atom-dev-'))
  const main = mkdtempSync(join(tmpdir(), 'atom-main-'))
  const incumbent = atom('selected', '1.0.0')
  const unrelated = atom('unrelated', '4.0.0')
  ;[dev, main].forEach((branch) => {
    writeFileSync(join(branch, 'selected.atom.json'), JSON.stringify(incumbent))
    writeFileSync(join(branch, 'unrelated.atom.json'), JSON.stringify(unrelated))
  })
  stageAtom(source, atom('selected', '2.0.0-pre', 'draft'))
  assert.deepEqual(registerAtoms(source, dev, 'draft', ['selected']), ['selected.atom.json'])
  assert.equal(atomAt(dev, 'selected').version, '2.0.0-pre')
  assert.equal('release_kind' in atomAt(dev, 'selected'), false)
  assert.deepEqual(atomAt(main, 'selected'), incumbent)
  stageAtom(source, atom('selected', '2.0.0-pre', 'prerelease'))
  writeFileSync(join(dev, 'selected.draft.atom.json'), JSON.stringify(atom('selected', '2.0.0-pre', 'draft')))
  registerAtoms(source, dev, 'prerelease', ['selected'])
  const candidate = readFileSync(join(dev, 'selected.atom.json'))
  registerAtoms(source, dev, 'prerelease', ['selected'])
  assert.deepEqual(readFileSync(join(dev, 'selected.atom.json')), candidate)
  assert.equal(existsSync(join(dev, 'selected.draft.atom.json')), false)
  stageAtom(source, atom('selected', '2.0.0', 'live'))
  registerAtoms(source, main, 'live', ['selected'])
  assert.equal(atomAt(main, 'selected').version, '2.0.0')
  assert.equal(atomAt(dev, 'selected').version, '2.0.0-pre')
  assert.deepEqual(atomAt(dev, 'unrelated'), unrelated)
  assert.deepEqual(atomAt(main, 'unrelated'), unrelated)
})

test('dev assembles every committed atom and list into one signed index.json', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dev-index-'))
  const source = mkdtempSync(join(tmpdir(), 'candidate-source-'))
  const { privateKey, publicKey } = await generateKey({ type: 'ecc', userIDs: [{ name: 'fixture' }], format: 'armored' })
  const publisher = await builder.publicKeyFingerprint(publicKey)
  stageAtom(source, atom('candidate', '2.0.0-pre', 'prerelease'))
  registerAtoms(source, directory, 'prerelease', ['candidate'])
  const candidate = atomAt(directory, 'candidate')
  const index = await assembleSignedIndex(directory, [atom('incumbent', '1.0.0'), candidate], [], publisher, [], privateKey, builder)
  const bytes = readFileSync(join(directory, 'index.json'))
  const signature = readFileSync(join(directory, 'index.json.sig'), 'utf8')
  assert.deepEqual(index.plugins.map((entry) => entry.name), ['candidate', 'incumbent'])
  assert.equal(existsSync(join(directory, 'prerelease-index.json')), false)
  assert.equal(existsSync(join(directory, 'draft-index.json')), false)
  assert.equal(await builder.verifyDetached(bytes, signature, publicKey), true)
  assert.equal(await builder.verifyDetached(Buffer.concat([bytes, Buffer.from(' ')]), signature, publicKey), false)
})

test('registration refuses a candidate publisher change before replacing the incumbent', () => {
  const source = mkdtempSync(join(tmpdir(), 'publisher-source-'))
  const target = mkdtempSync(join(tmpdir(), 'publisher-target-'))
  const incumbent = atom('selected', '1.0.0')
  writeFileSync(join(target, 'selected.atom.json'), JSON.stringify(incumbent))
  stageAtom(source, { ...atom('selected', '2.0.0-pre', 'draft'), publisher: 'another-key' })
  assert.throws(() => registerAtoms(source, target, 'draft', ['selected']), /publisher identity changed/)
  assert.deepEqual(atomAt(target, 'selected'), incumbent)
})
