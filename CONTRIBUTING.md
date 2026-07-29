# Contributing

Thanks for working on `main-index`, the Bespok3d org's published plugin index. It is a static,
federated registry: it lists the plugin lists, each list points to its atoms, and the desktop app
follows that chain to discover installable packages. See [README.md](README.md) for the shape and how
it is assembled.

## Before you write code

Read [CLAUDE.md](CLAUDE.md). It is the contract for changes here: the non-negotiables (RULE ZERO: no
em-dash or en-dash; every identifier carries domain meaning; nesting beyond one level is suspicious),
and the working procedure. If you use an AI assistant, point it at that file; `AGENTS.md` sends
non-Claude tools there too.

Most of what lands here is generated. A plugin repo's CI registers its list through the index's
Action; you rarely hand-edit `index.json` or the assembled lists. If you are adding a list source or
changing how the index assembles, that is the code to touch, and it ships with a test.

## Develop

```sh
bash scripts/check.sh
```

Run it before every push; CI runs the same gate.

## Constraints

- The maintainer owns git history and releases; submit changes as a pull request against `dev`.
- Do not hand-edit generated index output to work around a bug; fix the assembler and let it regenerate.

## Signing off your work

Every commit must carry a `Signed-off-by` line. It is your statement that you wrote the change, or
that you otherwise have the right to contribute it, under the terms of the Developer Certificate of
Origin (<https://developercertificate.org/>). Git writes the line for you:

```sh
git commit -s -m "your message"
```

A pull request whose commits are not signed off cannot be merged.

## Licence

This repository is under the GNU Affero General Public License, version 3 or any later version. The
full text is in [LICENSE](LICENSE).

By contributing you agree that your contribution is licensed under those same terms. You keep the
copyright in what you write. There is no copyright assignment and no contributor licence agreement to
sign.
