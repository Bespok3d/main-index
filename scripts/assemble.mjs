// Assemble the published Bespok3d list (index.json) from the per-plugin atoms in atoms/. Each atom
// is one catalog entry emitted by a plugin's CI, carrying a raw `require` so cross-plugin `deps` are
// resolved HERE, across all atoms (a plugin requiring a service maps to whichever atom provides it).
// The output is the ADR-0012 federated-index shape, byte-identical to what the monorepo generates,
// so the app loads it through the same resolver. Signing (index.json.sig) is deferred.

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

function serviceName(provided) {
  return typeof provided === 'string' ? provided : provided.service
}

function requiredServices(atom) {
  return (atom.require ?? []).map((requirement) => requirement.service)
}

function providerByService(atoms) {
  const providers = {}
  atoms.forEach((atom) => {
    ;(atom.provides ?? []).forEach((provided) => {
      const service = serviceName(provided)
      if (!(service in providers)) providers[service] = atom.name
    })
  })
  return providers
}

function resolveDeps(atom, providers) {
  const resolved = []
  requiredServices(atom).forEach((service) => {
    const providerId = providers[service] ?? service
    if (!resolved.includes(providerId)) resolved.push(providerId)
  })
  return resolved
}

// Drop the internal `require` (only the resolver needs it) and replace it with the resolved `deps`,
// so each published entry matches the catalog entry shape the app expects.
export function assemble(atoms) {
  const sorted = [...atoms].sort((earlier, later) => earlier.name.localeCompare(later.name))
  const providers = providerByService(sorted)
  const plugins = sorted.map((atom) => {
    const { require: _require, ...entry } = atom
    return { ...entry, deps: resolveDeps(atom, providers) }
  })
  const updated = plugins.reduce((latest, plugin) => (plugin.updated_at > latest ? plugin.updated_at : latest), '')
  return { schema_version: 1, name: 'Bespok3d Official', publisher: 'PLACEHOLDER', updated, plugins, lists: [] }
}

async function main() {
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  const repoDir = dirname(scriptDir)
  const atomsDir = join(repoDir, 'atoms')
  const names = (await readdir(atomsDir).catch(() => [])).filter((name) => name.endsWith('.atom.json'))
  const atoms = await Promise.all(names.map((name) => readFile(join(atomsDir, name), 'utf8').then(JSON.parse)))
  const index = assemble(atoms)
  await writeFile(join(repoDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`)
  process.stdout.write(`Wrote index.json (${index.plugins.length} plugins)\n`)
}

if (process.argv[1] && process.argv[1].endsWith('assemble.mjs')) {
  main().catch((error) => {
    process.stderr.write(`assemble failed: ${error.message}\n`)
    process.exit(1)
  })
}
