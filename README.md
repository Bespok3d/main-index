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
service-provider map across all atoms AND across the plugins the referenced sub-lists publish, then
resolves each plugin's `deps` (store ids) and writes `index.json`. The sub-lists are read because a
plugin here can require a service a plugin in a sub-list provides (every feature plugin requires a
door from the `u1-base` list), and the atoms alone cannot name that provider. A require nothing
provides STOPS the assembly: a dep is a store plugin id, so writing the service name there would
publish a package name no registry can serve and make every plugin behind it un-installable. The
resolution itself is the `b3-builder` core's, imported, so the two assemblers cannot drift apart.
A Live plugin CI commits its atom to `main`. A draft or prerelease opens an atom PR against `dev`;
after merge the same `assemble-index` workflow signs `dev/index.json`. Live reads `main/index.json`;
Staging also reads `dev/index.json` as a separate source. Neither index filters by release kind.

Adding/updating a plugin = a change to one `atoms/<name>.atom.json`. Atom sub-categorization may be
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

## Release branches

Assembly emits and signs the same `index.json` on `main` and `dev`, from that branch's atoms and
lists. `release_kind` describes how the unit was published on GitHub; it never filters the catalog.
The existing `channel` stability ceiling is unchanged. `verify-index.mjs` verifies the detached
signature over the exact assembled bytes on either branch.

Registration accepts `release-kind` and explicit `selected-ids`, reads only those unit atoms and
writes the selected `<unit>.atom.json` on the chosen branch. A candidate cannot overwrite its
incumbent Live atom on `main`.
Candidate registration opens a PR to `dev`; the PR workflow validates its prospective index, and
merging triggers signed dev assembly. `MAIN_INDEX_TOKEN` needs contents write and pull requests
write for this step. Live registration remains on `main`.
Draft-to-prerelease updates the same dev atom. Retries retain unrelated units and the publisher
identity. Co-repositories keep their Live sub-list and register selected candidate atoms on dev.

The PR assembly workflow checks the proposed atom set across all three catalogs without publication
credentials; fixture tests use throwaway keys to verify each signature. Final public tooling pins
must be available before consumer publication.
