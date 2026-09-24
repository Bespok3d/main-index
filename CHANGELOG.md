# Index Changelog

What changed in the published plugin index. Entries are dated by the day the index was assembled and
published, not by the day a plugin released.

This file starts with the index as it stood for app alpha 33. Anything before that is in the git log.

---

## Unreleased

### Atoms can be submitted by pull request

Registering atoms used to need a token with write access to this repository. The `register-atoms`
Action now also takes `submission: pull-request`: a `contributor-token` owned by the publisher is
enough, and the Action forks this repository, checks the prospective assembly before anything is
written, pushes one run-specific branch to the fork and opens a pull request against `main`. A
`prospective-index` check assembles every such pull request with no secrets. The direct maintainer
path (`submission: direct`) is unchanged.

### The key bucket has a lookup contract

`keys/README.md` now states how a key registered here is found: `keys/<account-lowercased>-publisher.pub.asc`.
The app accepts such a key only when its own fingerprint equals the `publisher` the artifact declares
and the detached signature checks out over the exact served bytes.

---

## 2026-07-30

### A plugin repository can publish its list as a release asset

A sub-list used to be a file committed in its plugin repository, addressed as
`github:<owner>/<repo>/<path>`. It can now be an asset of the same release its `.b3` packages ship in,
addressed as `https://github.com/<owner>/<repo>/releases/latest/download/<file>`. Publishing a release
then writes nothing back into the plugin repository, and the address does not change when the next
release lands.

Both shapes are read, and the older one keeps working: a ref is only rewritten when its own repository
next releases.

Both readers of that address were taught the new shape at once, in one place:

- the assembler reads the owner off a ref to stamp trust, author and publisher. A list published from
  the `Bespok3d` account is stamped **project**; anything else is **community**. Before this, a release
  asset ref was unreadable and every org list published that way would have quietly dropped to
  **community**;
- the signing sweep reads the bytes actually served at that address, so it checks the signature over
  the same file a reader downloads.

### What the index lists

Ten sub-lists and ten shared packages. The shared packages moved:

| Package | Was | Now |
| --- | --- | --- |
| Camera HW Accel | 0.1.8 | 0.1.9 |
| Panda Breath | 0.1.0 | 0.1.1 |
| Remote Screen | 0.1.21 | 0.1.22 |
| RFID NTAG | 0.1.7 | 0.1.8 |

The other six are unchanged: Fluidd 0.1.4, Mainsail 0.1.5, Moonraker Auth 0.1.1, OctoEverywhere
0.1.1, Spoolman 0.1.29, Timelapse 0.1.1.
