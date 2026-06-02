# main-index

The official **Bespok3d** plugin list. The app fetches `index.json` from this repo and browses the
catalog from it (no `.b3` download until install). It is a static, federated registry per ADR-0012;
see the Bespok3d docs `doc/anatomy-of-a-list.md` and `doc/package-format.md`.

## How it works

The list is **assembled from atoms**, not hand-edited:

```text
atoms/<name>.atom.json   one catalog entry per plugin, written by that plugin's repo CI
scripts/assemble.mjs     reads all atoms, resolves cross-plugin deps, emits index.json
index.json               the published catalog the app loads (generated; do not hand-edit)
```

Each atom carries a raw `require` (the services the plugin needs). `assemble.mjs` builds a
service-provider map across all atoms and resolves each plugin's `deps` (store ids), then writes
`index.json` in the ADR-0012 shape. A plugin's CI commits its atom here; the `assemble-index`
workflow rebuilds `index.json` on every atom change.

Adding/updating a plugin = a change to one `atoms/<name>.atom.json` (today the org's plugin CIs
direct-commit theirs; external submissions will come via PR later). Atom sub-categorization may be
introduced later; for now they live flat under `atoms/`.

Signing (`index.json.sig`) is deferred during private testing.

## Local

```sh
node scripts/assemble.mjs   # rebuild index.json from atoms/
```
