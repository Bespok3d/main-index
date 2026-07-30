// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// Unit tests for the collection (kind:collection) path through main-index assemble.mjs: a collection
// atom committed here is partitioned into the published collections[] (kind stripped), and the
// envelope always carries a collections[] slot. Run with: node --test scripts/assemble.test.mjs

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { assemble } from './assemble.mjs'

const COLLECTION_ATOM = {
  kind: 'collection',
  name: 'all-the-tags',
  title: 'All the Tags',
  version: '0.1.0',
  updated_at: '2026-06-30',
  members: [{ id: 'rfid-ntag', version: '>=0.1.6' }],
  doc_url: 'all-the-tags/doc/README.md',
  publisher: 'PLACEHOLDER',
}

const PLUGIN_ATOM = {
  name: 'spoolman',
  title: 'Spoolman',
  version: '0.1.4',
  updated_at: '2026-05-31',
  provides: ['spoolman-service'],
  require: [],
  conflicts: [],
  download_url: 'spoolman-0.1.4.b3',
  publisher: 'PLACEHOLDER',
}

test('assemble partitions collection atoms into collections[] and strips the kind discriminator', () => {
  const index = assemble([PLUGIN_ATOM, COLLECTION_ATOM], [])
  assert.deepEqual(index.plugins.map((plugin) => plugin.name), ['spoolman'])
  assert.equal(index.collections.length, 1)
  assert.equal(index.collections[0].name, 'all-the-tags')
  assert.equal(index.collections[0].kind, undefined)
  assert.deepEqual(index.collections[0].members, [{ id: 'rfid-ntag', version: '>=0.1.6' }])
  assert.equal(index.updated, '2026-06-30')
})

test('assemble keeps stamping list trust and always emits a collections[] slot', () => {
  const index = assemble([], [{ name: 'Material Tags', url: 'github:Bespok3d/material-tags/index.json' }])
  assert.deepEqual(index.collections, [])
  assert.equal(index.lists[0].trust, 'project')
})

test('assemble stamps the org author on the store envelope', () => {
  const index = assemble([PLUGIN_ATOM], [], 'AABBCCDD')
  assert.equal(index.author, 'bespoked')
  assert.deepEqual(Object.keys(index), ['schema_version', 'name', 'publisher', 'author', 'updated', 'plugins', 'collections', 'lists'])
})

test('assemble stamps org author and the signer publisher onto an org-owned list ref', () => {
  const index = assemble([], [{ name: 'Material Tags', url: 'github:Bespok3d/material-tags/index.json' }], 'AABBCCDD')
  assert.equal(index.lists[0].author, 'bespoked')
  assert.equal(index.lists[0].publisher, 'AABBCCDD')
  assert.deepEqual(Object.keys(index.lists[0]), ['name', 'url', 'trust', 'author', 'publisher'])
})

test('assemble stamps an org list published as a release asset exactly like one read from the repo', () => {
  const released = 'https://github.com/Bespok3d/material-tags/releases/latest/download/index.json'
  const index = assemble([], [{ name: 'Material Tags', url: released }], 'AABBCCDD')
  assert.equal(index.lists[0].trust, 'project')
  assert.equal(index.lists[0].author, 'bespoked')
  assert.equal(index.lists[0].publisher, 'AABBCCDD')
})

test('assemble leaves a third-party list ref without an org author or publisher, and lets a ref override', () => {
  const community = assemble([], [{ name: 'Acme Tags', url: 'github:Acme/tags/index.json' }], 'AABBCCDD')
  assert.equal(community.lists[0].trust, 'community')
  assert.equal('author' in community.lists[0], false)
  assert.equal('publisher' in community.lists[0], false)
  const pinned = assemble([], [{ name: 'Acme Tags', url: 'github:Acme/tags/index.json', author: 'acme', publisher: 'EE55' }], 'AABBCCDD')
  assert.equal(pinned.lists[0].author, 'acme')
  assert.equal(pinned.lists[0].publisher, 'EE55')
})

test('assemble overrides each plugin and collection publisher with the derived signer identity', () => {
  const index = assemble([PLUGIN_ATOM, COLLECTION_ATOM], [], 'AABBCCDD')
  assert.equal(index.plugins[0].publisher, 'AABBCCDD')
  assert.equal(index.collections[0].publisher, 'AABBCCDD')
})
