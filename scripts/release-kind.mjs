// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
const RELEASE_KINDS = new Set(['live', 'prerelease', 'draft'])

export function atomReleaseKind(atom) {
  const kind = atom.release_kind ?? 'live'
  if (!RELEASE_KINDS.has(kind)) throw new Error(`invalid atom release_kind: ${kind}`)
  if (atom.release_kind !== undefined && String(atom.version).endsWith('-pre') !== (kind !== 'live')) throw new Error(`atom version/kind mismatch: ${atom.name}`)
  return kind
}
