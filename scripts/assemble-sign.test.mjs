// Proves index.json.sig verifies against the committed pubkey (keys/bespok3d-list.pub.asc).
// The real private key is never committed or embedded here (REGISTRY_SIGNING_KEY is a GitHub
// Actions secret only) -- the sign/verify round trip runs only when that env var is supplied
// (CI's secret, or a transient local export), mirroring assemble.mjs's own no-op-when-absent gate.
// Run with: node --test scripts/assemble-sign.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { importBuilderCore, writeIndexSignature, writeSignedIndex } from './assemble.mjs'

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

// A stale .sig outlives the index it signed, and the app reads that mismatch as tampering rather than
// as an unsigned list -- so an unsigned run must remove it. The builder is unused on the no-key path.
test('an unsigned run deletes the index.json.sig a signed run left behind', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'assemble-sig-'))
  const signaturePath = join(workDir, 'index.json.sig')
  await writeFile(signaturePath, 'stale signature from an earlier signed run\n')
  const signed = await writeIndexSignature(workDir, '{}\n', undefined, null)
  assert.equal(signed, false)
  assert.equal(existsSync(signaturePath), false)
  await rm(workDir, { recursive: true, force: true })
})

// index.json and its .sig are one artifact. Writing the index before signing would leave the new index
// beside the PREVIOUS run's signature whenever signing throws, and the app reads that mismatch as
// tampering. Signing first means a signing failure leaves the last good pair untouched.
test('a signing failure writes nothing, so the previous index and signature survive', async () => {
  const workDir = await mkdtemp(join(tmpdir(), 'assemble-sig-'))
  await writeFile(join(workDir, 'index.json'), '{"name":"previous good index"}\n')
  await writeFile(join(workDir, 'index.json.sig'), 'signature over the previous good index\n')
  const failingBuilder = { signDetached: () => Promise.reject(new Error('no such key')) }
  await assert.rejects(() => writeSignedIndex(workDir, '{"name":"new index"}\n', 'a-signing-key', failingBuilder))
  assert.equal(await readFile(join(workDir, 'index.json'), 'utf8'), '{"name":"previous good index"}\n')
  assert.equal(await readFile(join(workDir, 'index.json.sig'), 'utf8'), 'signature over the previous good index\n')
  await rm(workDir, { recursive: true, force: true })
})
