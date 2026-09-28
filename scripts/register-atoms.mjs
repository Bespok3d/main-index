// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { atomReleaseKind } from './release-kind.mjs'

export function registerAtoms(sourceDir, targetDir, kind, selectedIds) {
  if (!['live', 'draft', 'prerelease'].includes(kind)) throw new Error('invalid registration release kind')
  if (!selectedIds.length || new Set(selectedIds).size !== selectedIds.length) throw new Error('registration needs explicit unique selected IDs')
  const atoms = selectedIds.map((name) => readSelected(sourceDir, name, kind))
  mkdirSync(targetDir, { recursive: true })
  const existing = readdirSync(targetDir).filter((name) => name.endsWith('.atom.json')).map((name) => ({ filename: name, atom: JSON.parse(readFileSync(join(targetDir, name), 'utf8')) }))
  atoms.forEach((atom) => {
    const incumbents = existing.filter((entry) => entry.atom.name === atom.name)
    if (incumbents.some((entry) => entry.atom.publisher !== atom.publisher)) throw new Error(`publisher identity changed: ${atom.name}`)
  })
  atoms.forEach((atom) => registerOne(atom, existing, targetDir))
  return atoms.map((atom) => `${atom.name}.atom.json`)
}

function readSelected(sourceDir, name, kind) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) throw new Error('unsafe selected unit ID')
  const filename = `${name}.${kind}.atom.json`
  const legacy = join(sourceDir, `${name}.atom.json`)
  const path = existsSync(join(sourceDir, filename)) ? join(sourceDir, filename) : legacy
  const atom = JSON.parse(readFileSync(path, 'utf8'))
  if (atom.name !== name || atomReleaseKind(atom) !== kind) throw new Error(`selected atom identity mismatch: ${name}`)
  if (atom.kind !== 'collection' && !/^https:\/\//.test(atom.download_url ?? '')) throw new Error(`selected atom lacks published URL: ${name}`)
  const { release_kind: _releaseKind, ...catalogAtom } = atom
  return catalogAtom
}

function registerOne(atom, existing, targetDir) {
  const destination = `${atom.name}.atom.json`
  writeFileSync(join(targetDir, destination), `${JSON.stringify(atom, null, 2)}\n`)
  existing.filter((entry) => entry.atom.name === atom.name && entry.filename !== destination)
    .forEach((entry) => rmSync(join(targetDir, entry.filename), { force: true }))
}

if (process.argv[1]?.endsWith('/register-atoms.mjs')) {
  try { registerAtoms(process.argv[2], process.argv[3], process.argv[4], process.argv.slice(5)) }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1 }
}
