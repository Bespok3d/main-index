// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The sub-list ref grammar, pinned. A plugin repo now publishes its list as an asset of its own release
// instead of committing it, so a ref carries a release address. Trust is read off the ref owner, so a
// shape this file fails to recognise does not merely go unread: it silently demotes an org list to
// third-party and drops its author and publisher, with every check still green.
// Run with: node --test scripts/list-ref-url.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { listRefOwner, servedListUrl } from './list-ref-url.mjs'

const RELEASE_ASSET_REF = 'https://github.com/Bespok3d/networking/releases/latest/download/index.json'
const CONTENTS_REF = 'github:Bespok3d/networking/index.json'

test('the owner of a release-asset ref is the account that published the release', () => {
  assert.equal(listRefOwner(RELEASE_ASSET_REF), 'Bespok3d')
  assert.equal(listRefOwner('https://github.com/Acme/tags/releases/latest/download/index.json'), 'Acme')
})

test('the owner of a contents ref is still read, so a ref only changes when its repo next releases', () => {
  assert.equal(listRefOwner(CONTENTS_REF), 'Bespok3d')
})

test('a ref in neither shape has no owner, so it can never be taken for an org list', () => {
  assert.equal(listRefOwner('https://example.com/index.json'), undefined)
  assert.equal(listRefOwner('https://github.com/Bespok3d/networking/blob/main/index.json'), undefined)
})

test('a release-asset ref is served from the address it already names, and its signature sits beside it', () => {
  assert.equal(servedListUrl(RELEASE_ASSET_REF), RELEASE_ASSET_REF)
  assert.equal(`${servedListUrl(RELEASE_ASSET_REF)}.sig`, `${RELEASE_ASSET_REF}.sig`)
})

test('a contents ref is served from the GitHub contents API', () => {
  assert.equal(servedListUrl(CONTENTS_REF), 'https://api.github.com/repos/Bespok3d/networking/contents/index.json')
})

test('a ref the sweep cannot read is refused, never quietly reported as unpublished', () => {
  assert.throws(() => servedListUrl('https://example.com/index.json'), /not a sub-list url/)
})
