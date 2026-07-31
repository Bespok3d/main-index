#!/usr/bin/env node
// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Read every sub-list this index sends the app to, the way the app reads it: fetch the exact served
// index.json bytes and the detached signature beside them, and check the pair against the org public key
// checked in under keys/. Nothing used to check this. A sub-list published with no signature, or signed
// over the bytes CI later rewrote, showed up in the app as an unsigned list and in every CI run as green,
// so the only way to learn it was to open the app and look at a badge. This is that look, automated.
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { importBuilderCore } from './assemble.mjs'
import { servedListUrl } from './list-ref-url.mjs'

const GITHUB_RAW_HEADERS = { Accept: 'application/vnd.github.raw', 'X-GitHub-Api-Version': '2022-11-28' }

function readerHeaders() {
  const token = process.env.GITHUB_TOKEN
  return token ? { ...GITHUB_RAW_HEADERS, Authorization: `Bearer ${token}` } : GITHUB_RAW_HEADERS
}

async function fetchServed(url) {
  const response = await fetch(url, { headers: readerHeaders() })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)

  return new Uint8Array(await response.arrayBuffer())
}

// Unreachable is not the same as unsigned, and neither is the same as a bad signature. Each verdict names
// what a reader of that list would actually see, because the fix differs: republish, sign, or investigate.
export async function verdictForList(listUrl, armoredPublicKey, builder) {
  const served = servedListUrl(listUrl)
  const servedBytes = await fetchServed(served)
  if (servedBytes === null) return 'no index.json published'
  const armoredSignature = await fetchServed(`${served}.sig`)
  if (armoredSignature === null) return 'no signature beside it: the app can only show this list as unknown'
  const verified = await builder.verifyDetached(servedBytes, new TextDecoder().decode(armoredSignature), armoredPublicKey)

  return verified ? 'ok' : 'the signature does not check out over the served bytes: the app refuses this list'
}

export async function sweepPublishedLists(repoDir, builder) {
  const armoredPublicKey = await readFile(join(repoDir, 'keys', 'bespok3d-list.pub.asc'), 'utf8')
  const listsDir = join(repoDir, 'lists')
  const names = (await readdir(listsDir)).filter((name) => name.endsWith('.json'))
  const lists = await Promise.all(names.map((name) => readFile(join(listsDir, name), 'utf8').then(JSON.parse)))

  return Promise.all(
    lists.map(async (list) => ({ name: list.name, verdict: await verdictForList(list.url, armoredPublicKey, builder) })),
  )
}

async function main() {
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  const repoDir = join(scriptDir, '..')
  const swept = await sweepPublishedLists(repoDir, await importBuilderCore(scriptDir))
  swept.forEach((list) => process.stdout.write(`${list.verdict === 'ok' ? 'ok  ' : 'BAD '} ${list.name}: ${list.verdict}\n`))
  const broken = swept.filter((list) => list.verdict !== 'ok')
  if (broken.length === 0) {
    process.stdout.write(`all ${swept.length} published sub-lists verify against the org key\n`)
    return
  }
  process.stderr.write(`${broken.length} of ${swept.length} published sub-lists do not verify against the org key\n`)
  process.exit(1)
}

if (process.argv[1] !== undefined && process.argv[1].endsWith('verify-lists.mjs')) {
  main().catch((error) => {
    process.stderr.write(`verify-lists failed: ${error.message}\n`)
    process.exit(1)
  })
}
