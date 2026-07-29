# main-index

[![licence](https://img.shields.io/badge/licence-AGPL--3.0-blue)](LICENSE)
[![release](https://img.shields.io/github/v/release/Bespok3d/main-index)](https://github.com/Bespok3d/main-index/releases)
![stock firmware](https://img.shields.io/badge/stock%20firmware-no%20flashing-brightgreen)

The official **Bespok3d** plugin list. The app fetches `index.json` from this repo and browses the
catalog from it (no `.b3` download until install). It is a static, federated registry: the app fetches
one index of lists, follows each list to its atoms, and never trusts an unsigned pair.

## How it works

The list is **assembled from atoms**, not hand-edited:

```text
atoms/<name>.atom.json   one catalog entry per plugin, written by that plugin's repo CI
scripts/assemble.mjs     reads all atoms, resolves cross-plugin deps, emits index.json
scripts/verify-index.mjs proves index.json.sig checks out over index.json (the app refuses a pair that does not)
scripts/verify-lists.mjs fetches every sub-list this index links to and checks its published signature
index.json               the published catalog the app loads (generated; do not hand-edit)
```

Each atom carries a raw `require` (the services the plugin needs). `assemble.mjs` builds a
service-provider map across all atoms and resolves each plugin's `deps` (store ids), then writes
`index.json`. A plugin's CI commits its atom here; the `assemble-index`
workflow rebuilds `index.json` on every atom change.

Adding/updating a plugin = a change to one `atoms/<name>.atom.json` (today the org's plugin CIs
direct-commit theirs; external submissions will come via PR later). Atom sub-categorization may be
introduced later; for now they live flat under `atoms/`.

`index.json` is published with a detached signature (`index.json.sig`) made by the org registry key,
whose public half is committed at `keys/bespok3d-list.pub.asc` and pinned in the app. The app checks
that signature before it shows anything from this list, so index and signature are one artifact: an
index committed without re-signing it reads as tampering, not as an unsigned list. The assemble
workflow refuses to publish a pair that does not check out.

## Local

```sh
node scripts/assemble.mjs        # rebuild index.json from atoms/
node scripts/verify-index.mjs    # prove index.json.sig checks out over index.json
node --test scripts/*.test.mjs   # the repo's own tests

# Every sub-list this index links to, checked the way the app checks it. Needs a token that can read
# the org's plugin repos, because they are private.
GITHUB_TOKEN=$(gh auth token) node scripts/verify-lists.mjs
```

## Licence

Copyright (C) 2026 unlucio and the Bespok3d contributors

This program is free software: you can redistribute it and/or modify it under the terms of the GNU
Affero General Public License as published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero
General Public License for more details.

You should have received a copy of the GNU Affero General Public License along with this program. If
not, see <https://www.gnu.org/licenses/>. The full text is in [LICENSE](LICENSE).

Bespok3d is a project of the Bespok3d Organisation, which is not a legal entity. Copyright is held by
the individual authors named above.

## Support this project

Bespok3d is built and maintained in the open, on stock printer firmware. If it saved you an
afternoon, you can [buy me a coffee](https://buymeacoffee.com/unlucio).
