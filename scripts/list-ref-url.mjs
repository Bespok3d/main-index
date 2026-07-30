// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The shapes a sub-list ref in lists/*.json can carry, in ONE place, because two readers depend on the
// same grammar: the assembler reads the OWNER off a ref to stamp trust, author and publisher, and the
// signing sweep reads the SERVED BYTES off it. Splitting the grammar between them is how an added shape
// gets taught to one reader and silently downgrades every org list to community in the other.
//
// A release-asset ref is the shape a plugin repo publishes now: its list ships as an asset of the same
// release its .b3 files ship in, so a release writes nothing back into the plugin repo, and the
// latest-release address does not change when a new release lands. The github: contents ref is the older
// shape and stays readable, because a ref is only rewritten when its own repo next releases.
const CONTENTS_REF = /^github:([^/]+)\/([^/]+)\/(.+)$/
const RELEASE_ASSET_REF = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/latest\/download\/(.+)$/

// The account a sub-list is published from, or undefined for a ref in neither shape. Trust is read off
// this, so an unreadable ref must not resolve to an owner: unknown is third-party, never the org.
export function listRefOwner(url) {
  const ref = CONTENTS_REF.exec(url) ?? RELEASE_ASSET_REF.exec(url)
  return ref === null ? undefined : ref[1]
}

// The address the exact published bytes are fetched from, the way the app fetches them. The detached
// signature is always the same address with .sig appended, in both shapes.
export function servedListUrl(url) {
  if (RELEASE_ASSET_REF.test(url)) return url
  const contents = CONTENTS_REF.exec(url)
  if (contents === null) throw new Error(`${url} is not a sub-list url this sweep can read`)

  return `https://api.github.com/repos/${contents[1]}/${contents[2]}/contents/${contents[3]}`
}
