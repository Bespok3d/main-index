// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { assembleTiers, importBuilderCore } from './assemble.mjs'
import { registerAtoms } from './register-atoms.mjs'
import { TIER_FILES } from './release-tiers.mjs'

const require = createRequire(new URL('../../b3-builder/package.json', import.meta.url))
const { generateKey } = require('openpgp')
const builder = await importBuilderCore(new URL('.', import.meta.url).pathname)
function atom(name, version, release_kind) {
  return { name, version, publisher: 'fixture', download_url: `https://fixture.invalid/${name}-${version}.b3`, ...(release_kind ? { release_kind } : {}) }
}
function writeAtom(directory, entry) {
  writeFileSync(join(directory, `${entry.name}.${entry.release_kind ?? 'legacy'}.atom.json`), JSON.stringify(entry))
}
function readAtoms(directory) {
  const { readdirSync } = require('node:fs')
  return readdirSync(directory).map((name) => JSON.parse(readFileSync(join(directory, name), 'utf8')))
}

test('register incumbent, candidate draft, same candidate prerelease, then Live successor without losing unrelated units', () => {
  const source = mkdtempSync(join(tmpdir(), 'tier-source-'))
  const target = mkdtempSync(join(tmpdir(), 'tier-target-'))
  writeFileSync(join(target, 'selected.atom.json'), JSON.stringify(atom('selected', '1.0.0')))
  writeFileSync(join(target, 'unrelated.atom.json'), JSON.stringify(atom('unrelated', '4.0.0')))
  for (const kind of ['draft', 'prerelease', 'live']) {
    writeAtom(source, atom('selected', kind === 'live' ? '2.0.0' : '2.0.0-pre', kind))
    registerAtoms(source, target, kind, ['selected'])
    const before = readAtoms(target)
    registerAtoms(source, target, kind, ['selected'])
    assert.deepEqual(readAtoms(target), before)
    assert.equal(readAtoms(target).find((entry) => entry.name === 'unrelated').version, '4.0.0')
    if (kind !== 'live') assert.equal(readAtoms(target).find((entry) => entry.name === 'selected' && !entry.release_kind).version, '1.0.0')
  }
  assert.equal(existsSync(join(target, 'selected.draft.atom.json')), false)
  assert.equal(existsSync(join(target, 'selected.atom.json')), false)
  assert.equal(readAtoms(target).find((entry) => entry.release_kind === 'prerelease').version, '2.0.0-pre')
})

test('mixed atoms assemble into three independently valid signed indexes, including empty tiers', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'tier-indexes-'))
  const { privateKey, publicKey } = await generateKey({ type: 'ecc', userIDs: [{ name: 'fixture' }], format: 'armored' })
  const publisher = await builder.publicKeyFingerprint(publicKey)
  const atoms = [atom('incumbent', '1.0.0'), atom('candidate', '2.0.0-pre', 'draft'), atom('candidate', '2.0.0-pre', 'prerelease')]
  const indexes = await assembleTiers(directory, atoms, [], publisher, [], privateKey, builder)
  assert.deepEqual(indexes['index.json'].plugins.map((entry) => entry.name), ['incumbent'])
  assert.deepEqual(indexes['draft-index.json'].plugins, [])
  assert.deepEqual(indexes['prerelease-index.json'].plugins.map((entry) => entry.name), ['candidate'])
  for (const filename of Object.values(TIER_FILES)) {
    const bytes = readFileSync(join(directory, filename))
    const signature = readFileSync(join(directory, `${filename}.sig`), 'utf8')
    assert.equal(await builder.verifyDetached(bytes, signature, publicKey), true)
    assert.equal(await builder.verifyDetached(Buffer.concat([bytes, Buffer.from(' ')]), signature, publicKey), false)
  }
})

test('registration refuses a candidate publisher change before replacing any membership', () => {
  const source = mkdtempSync(join(tmpdir(), 'publisher-source-'))
  const target = mkdtempSync(join(tmpdir(), 'publisher-target-'))
  const incumbent = atom('selected', '1.0.0')
  writeFileSync(join(target, 'selected.atom.json'), JSON.stringify(incumbent))
  writeAtom(source, { ...atom('selected', '2.0.0-pre', 'draft'), publisher: 'another-key' })
  assert.throws(() => registerAtoms(source, target, 'draft', ['selected']), /publisher identity changed/)
  assert.deepEqual(readAtoms(target), [incumbent])
})
