// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Assemble the published Bespok3d list (index.json) from the per-plugin atoms in atoms/. Each atom
// is one catalog entry emitted by a plugin's CI, carrying a raw `require` so cross-plugin `deps` are
// resolved HERE, across all atoms (a plugin requiring a service maps to whichever atom provides it).
// The output is the ADR-0012 federated-index shape, byte-identical to what the monorepo generates,
// so the app loads it through the same resolver. `index.json` is detached-signed with the org's
// registry key (see keys/README.md); `publisher` carries that key's fingerprint.

import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { listRefOwner, servedListUrl } from './list-ref-url.mjs'

// Lazy dynamic import of the sibling b3-builder repo's built core, mirroring
// Bespok3d/scripts/app-bundle.mjs's importBuilderCore -- one signing implementation, not two.
export async function importBuilderCore(scriptDir) {
  const corePath = join(scriptDir, '..', '..', 'b3-builder', 'dist', 'core', 'index.js')
  return import(pathToFileURL(corePath).href)
}

// The service graph is resolved by the builder core's implementation, not by a copy living here. This
// file used to carry its own, and it carried the same defect: an unresolved service fell back to the
// raw service NAME, so the published index offered `rfid-service` as a dependency, an id no registry
// can serve, and every plugin behind it became un-installable. One implementation now decides what a
// dependency is, and it stops the assembly rather than publishing a name that resolves to nothing.
const { providerByService, requiredServiceNames, resolveDeps, readProviderSources } = await importBuilderCore(
  dirname(fileURLToPath(import.meta.url)),
)

function providersInAtoms(pluginAtoms) {
  return pluginAtoms.map((atom) => ({ name: atom.name, provides: atom.provides ?? [] }))
}

// The org that publishes this main list. A sub-list this org owns is first-party (trust 'project');
// any other list accepted into the main list is 'community'. Trust is curation, declared HERE.
//
// The tier written here is curation and stays spoofable on its own: it is read off the URL owner, so
// this file says who the curator MEANT. The proof is separate and it exists now: every sub-list is
// published with a detached signature over its served bytes, the app checks that signature before it
// shows any list, and `scripts/verify-lists.mjs` checks all of them at once against the org key in
// keys/. A tier claimed here that no signature backs shows in the app as unknown, never as trusted.
const OFFICIAL_OWNER = 'Bespok3d'

// The display name this org authors its own sub-lists under. Like trust, `author` is curation
// declared HERE, distinct from `publisher` (the signing-key fingerprint that PROVES the list): the
// two are separate fields because the human/org that authored a list and the key that signs it may
// differ, and only the signature is proof. A ref can pin its own author in lists/*.json and it wins.
const LIST_AUTHOR = 'bespoked'

function isOrgOwned(ref) {
  return listRefOwner(ref.url) === OFFICIAL_OWNER
}

// Trust a sub-list by who published it: an org-owned ref is org-published (project); anything else
// accepted into the list is third-party (community). A ref can pin its trust in lists/*.json (e.g. a
// manufacturer list) and that wins.
function listTrust(ref) {
  if (ref.trust) return ref.trust
  return isOrgOwned(ref) ? 'project' : 'community'
}

// Stamp a sub-list ref's author (display name) the same way trust is stamped: an org-owned ref is
// authored by this org; anything else keeps whatever it declared, and a ref can override.
function listAuthor(ref) {
  if (ref.author) return ref.author
  return isOrgOwned(ref) ? LIST_AUTHOR : undefined
}

// Stamp a sub-list ref's publisher (signing-key fingerprint) as the org key for an org-owned ref,
// mirroring the top-level `publisher`: the same registry key signs the main list and its own
// sub-lists. A ref can pin a different publisher (a list signed by another key) and it wins.
function listRefPublisher(ref, publisher) {
  if (ref.publisher) return ref.publisher
  return isOrgOwned(ref) ? publisher : undefined
}

function stampListRef(ref, publisher) {
  const author = listAuthor(ref)
  const refPublisher = listRefPublisher(ref, publisher)
  return {
    ...ref,
    trust: listTrust(ref),
    ...(author !== undefined ? { author } : {}),
    ...(refPublisher !== undefined ? { publisher: refPublisher } : {}),
  }
}

function isCollectionAtom(atom) {
  return atom.kind === 'collection'
}

// A collection atom carries `kind` only so the assembler can route it; strip it from the published
// entry (a collection's type is the collections[] array it sits in). Collections are
// install-orchestration metadata (a members[] list), never resolved to a .b3; trust is stamped at
// load time from the source ref, exactly like plugins, not declared here.
function toCollectionEntry(atom) {
  const { kind: _kind, ...entry } = atom
  return entry
}

// Drop the internal `require` (only the resolver needs it) and replace it with the resolved `deps`,
// so each published entry matches the catalog entry shape the app expects. `lists` are sub-list
// references ({name, url}) from lists/*.json: main-index is a list-of-lists (ADR-0012), so a
// co-repo that publishes its own index.json is referenced by URL here rather than copying its atoms.
// Collection atoms committed directly here are partitioned into a sibling collections[].
// `knownProviders` are the plugins the referenced sub-lists publish. An atom committed here can require
// a service a sub-list's plugin provides (every feature plugin requires a door from the u1-base list),
// and the atoms alone cannot name that provider, so the assembly reads the sub-lists it points readers
// at and resolves against both sets. Without them the requirement has no id and the assembly stops.
export function assemble(atoms, lists = [], publisher = 'PLACEHOLDER', knownProviders = []) {
  const sorted = [...atoms].sort((earlier, later) => earlier.name.localeCompare(later.name))
  const pluginAtoms = sorted.filter((atom) => !isCollectionAtom(atom))
  const collectionAtoms = sorted.filter(isCollectionAtom)
  const providers = providerByService([...providersInAtoms(pluginAtoms), ...knownProviders])
  const plugins = pluginAtoms.map((atom) => {
    const { require: _require, ...entry } = atom
    return { ...entry, deps: resolveDeps(atom.name, requiredServiceNames(atom), providers), publisher }
  })
  const collections = collectionAtoms.map((atom) => ({ ...toCollectionEntry(atom), publisher }))
  const updated = [...plugins, ...collections].reduce((latest, entry) => (entry.updated_at > latest ? entry.updated_at : latest), '')
  const sortedLists = [...lists]
    .sort((earlier, later) => earlier.name.localeCompare(later.name))
    .map((ref) => stampListRef(ref, publisher))
  return { schema_version: 1, name: 'Bespok3d Official', publisher, author: LIST_AUTHOR, updated, plugins, collections, lists: sortedLists }
}

// Placing the signature is a REPLACE, never an append. A run that produced no signature must DELETE the
// one a previous signed run left behind: those bytes no longer match the index sitting next to them, and
// the app reads a stale signature as a failed verification (tampering) rather than as an unsigned list.
async function placeIndexSignature(repoDir, signature) {
  const signaturePath = join(repoDir, 'index.json.sig')
  if (!signature) {
    await rm(signaturePath, { force: true })
    return false
  }
  await writeFile(signaturePath, signature)
  return true
}

export async function writeIndexSignature(repoDir, bytes, signingKey, builder) {
  return placeIndexSignature(repoDir, signingKey ? await builder.signDetached(Buffer.from(bytes, 'utf8'), signingKey) : null)
}

// index.json and its signature are ONE artifact, so they get written together. Writing the index first
// would leave it on disk beside the PREVIOUS run's .sig whenever signing throws, and a signature that
// does not match the index next to it reads as tampering, not as an unsigned list. Signing first means
// a signing failure aborts before anything is written and the last good pair survives untouched.
export async function writeSignedIndex(repoDir, bytes, signingKey, builder) {
  const signature = signingKey ? await builder.signDetached(Buffer.from(bytes, 'utf8'), signingKey) : null
  await writeFile(join(repoDir, 'index.json'), bytes)

  return placeIndexSignature(repoDir, signature)
}

async function readJsonDir(dir, suffix) {
  const names = (await readdir(dir).catch(() => [])).filter((name) => name.endsWith(suffix))
  return Promise.all(names.map((name) => readFile(join(dir, name), 'utf8').then(JSON.parse)))
}

async function main() {
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  const repoDir = dirname(scriptDir)
  const builder = await importBuilderCore(scriptDir)
  const pubkey = await readFile(join(repoDir, 'keys', 'bespok3d-list.pub.asc'), 'utf8')
  const publisher = await builder.publicKeyFingerprint(pubkey)
  const atoms = await readJsonDir(join(repoDir, 'atoms'), '.atom.json')
  const lists = await readJsonDir(join(repoDir, 'lists'), '.json')
  const knownProviders = await readProviderSources(lists.map((ref) => servedListUrl(ref.url)))
  const index = assemble(atoms, lists, publisher, knownProviders)
  const bytes = `${JSON.stringify(index, null, 2)}\n`
  const signed = await writeSignedIndex(repoDir, bytes, process.env.REGISTRY_SIGNING_KEY, builder)
  process.stdout.write(`Wrote index.json (${index.plugins.length} plugins, ${index.collections.length} collections, ${index.lists.length} lists)\n`)
  process.stdout.write(signed ? 'Wrote index.json.sig\n' : 'No REGISTRY_SIGNING_KEY: removed any stale index.json.sig\n')
}

if (process.argv[1] && process.argv[1].endsWith('assemble.mjs')) {
  main().catch((error) => {
    process.stderr.write(`assemble failed: ${error.message}\n`)
    process.exit(1)
  })
}
