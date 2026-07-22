#!/usr/bin/env node
// Check the published pair the way a reader checks it: the exact bytes of index.json, the detached
// signature sitting next to them, and the org public key checked in under keys/. The assemble run used to
// check only that a .sig EXISTED, which passes just as happily for a signature made over different bytes,
// and a signature that does not check out is a hard refusal in the app, not a downgrade. Runnable by hand
// (`node scripts/verify-index.mjs`) against a checkout, and run by the assemble workflow before it commits.
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { importBuilderCore } from './assemble.mjs'

const ORG_PUBLIC_KEY = join('keys', 'bespok3d-list.pub.asc')

export async function verifyPublishedIndex(repoDir, builder) {
  const servedBytes = await readFile(join(repoDir, 'index.json'))
  const armoredSignature = await readFile(join(repoDir, 'index.json.sig'), 'utf8')
  const armoredPublicKey = await readFile(join(repoDir, ORG_PUBLIC_KEY), 'utf8')

  return builder.verifyDetached(servedBytes, armoredSignature, armoredPublicKey)
}

async function main() {
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  const repoDir = join(scriptDir, '..')
  const verified = await verifyPublishedIndex(repoDir, await importBuilderCore(scriptDir))
  if (!verified) {
    process.stderr.write(`index.json.sig does not check out over index.json against ${ORG_PUBLIC_KEY}\n`)
    process.exit(1)
  }
  process.stdout.write(`index.json verifies against ${ORG_PUBLIC_KEY}\n`)
}

if (process.argv[1] !== undefined && process.argv[1].endsWith('verify-index.mjs')) {
  main().catch((error) => {
    process.stderr.write(`verify-index failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exit(1)
  })
}
