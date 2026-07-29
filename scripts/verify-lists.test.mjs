// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The sweep over every sub-list the main index sends the app to. Nothing checked those lists before, so
// the two states that actually shipped, a list published with no signature and a list signed over bytes
// CI later rewrote, were invisible from here and green in every run. Each verdict names what a reader of
// that list would see, so the tests pin the verdicts, not just a boolean.
// Run with: node --test scripts/verify-lists.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { importBuilderCore } from './assemble.mjs'
import { verdictForList } from './verify-lists.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoDir = dirname(scriptDir)
const A_LIST = 'github:Bespok3d/networking/index.json'

// The published pair in this repo is a real signed list, so it stands in for a well-published sub-list
// without a private key ever coming near a test.
async function servedPair() {
  return {
    bytes: await readFile(join(repoDir, 'index.json')),
    signature: await readFile(join(repoDir, 'index.json.sig'), 'utf8'),
  }
}

function answering(bodyByUrlSuffix) {
  return async function fetchStub(url) {
    const body = url.endsWith('.sig') ? bodyByUrlSuffix.signature : bodyByUrlSuffix.bytes
    if (body === undefined) return { status: 404, ok: false }

    return { status: 200, ok: true, arrayBuffer: async () => body }
  }
}

async function verdictWith(bodyByUrlSuffix) {
  const realFetch = globalThis.fetch
  globalThis.fetch = answering(bodyByUrlSuffix)
  try {
    const armoredPublicKey = await readFile(join(repoDir, 'keys', 'bespok3d-list.pub.asc'), 'utf8')

    return await verdictForList(A_LIST, armoredPublicKey, await importBuilderCore(scriptDir))
  } finally {
    globalThis.fetch = realFetch
  }
}

test('a list whose signature checks out against the org key reads ok', async () => {
  const pair = await servedPair()

  const verdict = await verdictWith({ bytes: pair.bytes, signature: Buffer.from(pair.signature, 'utf8') })

  assert.equal(verdict, 'ok')
})

test('a list published with no signature beside it is reported, not passed', async () => {
  const pair = await servedPair()

  const verdict = await verdictWith({ bytes: pair.bytes })

  assert.match(verdict, /no signature beside it/)
})

test('a list signed over other bytes is reported as refused, not as unsigned', async () => {
  const pair = await servedPair()
  const rewrittenByCi = Buffer.from(`${pair.bytes.toString('utf8').replace('"plugins"', '"plugins "')}`, 'utf8')

  const verdict = await verdictWith({ bytes: rewrittenByCi, signature: Buffer.from(pair.signature, 'utf8') })

  assert.match(verdict, /does not check out/)
})
