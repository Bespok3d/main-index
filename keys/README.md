# Signing keys

## `bespok3d-list.pub.asc` — official list signing key

This is the **public** half of the key that signs this registry's `index.json`. The Bespok3d
app pins this key: it verifies the index signature against it, and the index in turn pins the
`sha256` of every package, so a trusted index implies trusted (untampered) packages. No
per-package signature is needed while the org is the sole publisher.

| | |
| --- | --- |
| Fingerprint | `6799 3955 5819 FB5F 6423 DC68 C438 8E76 BFA9 B4E0` |
| Type | RSA-4096, sign-only, no expiry |
| UID | `Bespok3d Registry Signing Key (official list signing key) <registry@bespok3d.org>` |
| Role | signs `index.json` in CI |

The **private** half lives only as the `REGISTRY_SIGNING_KEY` Actions secret on this repo; it is
never committed. A revocation certificate is held offline by the maintainer.

## `lixnix-publisher.pub.asc`: LixNix publisher key

The **public** half of the first external publisher's signing key, registered here so the org has
one canonical place to fetch and pin it from.

| | |
| --- | --- |
| Fingerprint | `0303 4E2A 0888 2463 984D  06E9 6098 E51D 45A9 4591` |
| Type | RSA-4096, no expiry |
| UID | `Bespok3d LixNix (Bespok3d.app) <LixNix@Bespok3d.app>` |
| Role | will sign `.b3` packages and the sub-list index of LixNix's plugin repos |

The **private** half lives only in the publisher's own repos' `REGISTRY_SIGNING_KEY` Actions
secrets; it is never committed. Registering the key here changes no trust by itself: the apps
still pin only the list key above, and refuse a `.b3` signed by any other key, so this publisher's
releases stay unsigned until the apps grow a second trust anchor for this fingerprint.

Until that anchor ships, the list key remains the only trust root.
