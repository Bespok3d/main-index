// Proves index.json.sig verifies against the committed pubkey (keys/bespok3d-list.pub.asc).
// The real private key is never committed or embedded here (REGISTRY_SIGNING_KEY is a GitHub
// Actions secret only) -- the sign/verify round trip runs only when that env var is supplied
// (CI's secret, or a transient local export), mirroring assemble.mjs's own no-op-when-absent gate.
// Run with: node --test scripts/assemble-sign.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { importBuilderCore } from './assemble.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoDir = dirname(scriptDir)
const KNOWN_FINGERPRINT = '679939555819FB5F6423DC68C4388E76BFA9B4E0'

test('publicKeyFingerprint derives the committed pubkey fingerprint', async () => {
  const builder = await importBuilderCore(scriptDir)
  const pubkey = await readFile(join(repoDir, 'keys', 'bespok3d-list.pub.asc'), 'utf8')
  const fingerprint = await builder.publicKeyFingerprint(pubkey)
  assert.equal(fingerprint.toUpperCase(), KNOWN_FINGERPRINT)
})

test('a signature made with REGISTRY_SIGNING_KEY verifies against the committed pubkey', async (t) => {
  const signingKey = process.env.REGISTRY_SIGNING_KEY
  if (!signingKey) {
    t.skip('REGISTRY_SIGNING_KEY not set; skipping real sign/verify round trip')
    return
  }
  const builder = await importBuilderCore(scriptDir)
  const pubkey = await readFile(join(repoDir, 'keys', 'bespok3d-list.pub.asc'), 'utf8')
  const bytes = Buffer.from('assemble-sign.test.mjs round trip\n', 'utf8')
  const signature = await builder.signDetached(bytes, signingKey)
  const verified = await builder.verifyDetached(bytes, signature, pubkey)
  assert.equal(verified, true)
})
