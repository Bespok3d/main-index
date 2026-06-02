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

Per-publisher package keys (for external contributors who sign their own `.b3`) are deferred
until there are external publishers; this list key is the only trust root for now.
