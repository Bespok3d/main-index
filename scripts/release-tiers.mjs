// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
export const TIER_FILES = { live: 'index.json', prerelease: 'prerelease-index.json', draft: 'draft-index.json' }

export function atomTier(atom) {
  const kind = atom.release_kind ?? 'live'
  if (!Object.hasOwn(TIER_FILES, kind)) throw new Error(`invalid atom release_kind: ${kind}`)
  if (atom.release_kind !== undefined && String(atom.version).endsWith('-pre') !== (kind !== 'live')) throw new Error(`atom version/kind mismatch: ${atom.name}`)
  return kind
}

export function atomsForTier(atoms, tier) {
  const selected = atoms.filter((atom) => atomTier(atom) === tier)
  const names = selected.map((atom) => atom.name)
  if (new Set(names).size !== names.length) throw new Error(`ambiguous duplicate ${tier} atom`)
  return selected.filter((atom) => tier !== 'draft' || !atoms.some((candidate) => atomTier(candidate) === 'prerelease' && candidate.name === atom.name && candidate.version === atom.version))
}
