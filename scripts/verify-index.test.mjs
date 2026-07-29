// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The published index and the signature beside it are ONE artifact, and the app refuses the pair when
// they disagree: a mismatch is a dead store, not a wrong badge. The assemble run used to check only that
// a .sig file EXISTED, which a hand-edit of index.json passes while leaving the pair broken, so these
// cover the check that replaced it. Run with: node --test scripts/verify-index.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { importBuilderCore } from './assemble.mjs'
import { verifyPublishedIndex } from './verify-index.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoDir = dirname(scriptDir)

test('the committed index.json and the signature beside it are the same artifact', async () => {
  const verified = await verifyPublishedIndex(repoDir, await importBuilderCore(scriptDir))
  assert.equal(verified, true)
})

// A hand-edited index.json keeps the previous run's signature sitting next to it, which is exactly the
// state the existence check waved through and the app reads as tampering.
test('an index edited after signing fails against the signature left beside it', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'verify-index-'))
  await mkdir(join(workDir, 'keys'))
  await copyFile(join(repoDir, 'keys', 'bespok3d-list.pub.asc'), join(workDir, 'keys', 'bespok3d-list.pub.asc'))
  await copyFile(join(repoDir, 'index.json.sig'), join(workDir, 'index.json.sig'))
  const published = await readFile(join(repoDir, 'index.json'), 'utf8')
  await writeFile(join(workDir, 'index.json'), published.replace('"schema_version": 1', '"schema_version": 2'))

  const verified = await verifyPublishedIndex(workDir, await importBuilderCore(scriptDir))

  assert.equal(verified, false)
  await rm(workDir, { recursive: true, force: true })
})
