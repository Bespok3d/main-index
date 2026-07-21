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

test('assemble overrides each plugin and collection publisher with the derived signer identity', () => {
  const index = assemble([PLUGIN_ATOM, COLLECTION_ATOM], [], 'AABBCCDD')
  assert.equal(index.plugins[0].publisher, 'AABBCCDD')
  assert.equal(index.collections[0].publisher, 'AABBCCDD')
})
