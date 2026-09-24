# Signing keys

## How the app looks a key up (the key bucket contract)

A publisher's public key is looked up in two places, in order:

1. **The publisher's conventional repository** (identity proof): `<account>/bespok3d-publisher` at
   `keys/<fingerprint>/key.asc`, the same path the Bespok3d app writes when a publisher uses
   Publish key. The key is there because that account published it.
2. **This key bucket** (registration fallback): `keys/<account-lowercased>-publisher.pub.asc` in
   this repository. `lixnix-publisher.pub.asc` below is that rule applied to the account `LixNix`;
   `bespok3d-list.pub.asc` is the same `<owner-lowercased>-<role>.pub.asc` shape for the list key.

A fetched key is accepted only when its own fingerprint equals the fingerprint the artifact
declares as its signer (hex compared without regard to letter case). A wrong or unreadable key at
one location does not stop the walk. No matching key anywhere means the signature proves nothing,
which the app shows rather than papering over. Registering a key here therefore requires the exact
`<account-lowercased>-publisher.pub.asc` filename, or the app will not find it.

## `bespok3d-list.pub.asc` - official list signing key

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

The **public** half of the first external publisher's signing key, registered here under the bucket
filename rule above so the app has one canonical fallback to fetch it from.

| | |
| --- | --- |
| Fingerprint | `0303 4E2A 0888 2463 984D  06E9 6098 E51D 45A9 4591` |
| Type | RSA-4096, no expiry |
| UID | `Bespok3d LixNix (Bespok3d.app) <LixNix@Bespok3d.app>` |
| Role | signs `.b3` packages and the sub-list index of LixNix's plugin repos |

The **private** half lives only in the publisher's own repos' `REGISTRY_SIGNING_KEY` Actions
secrets; it is never committed. A key registered here confers the community tier when its
signature checks out: the app looks for it at the publisher's own `bespok3d-publisher` repository
first and falls back here, and a proof from either earns the same "community" trust the verified
external publisher gets. The pinned list key above remains the only project-tier root.
