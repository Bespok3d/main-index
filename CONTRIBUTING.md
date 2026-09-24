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

## Submit a plugin atom

Follow the [publisher guide](https://github.com/Bespok3d/b3-builder/blob/main/doc/publishing-a-plugin.md)
for the complete root-plugin or plugin-directory path. The development-build publication path has
passed a packaged-app test against a simulated GitHub host; check the public file on GitHub before
claiming your key is published.

Run the [register-atoms Action](.github/actions/register-atoms/action.yml) with
`submission: pull-request`, `contributor-token` from your own GitHub account, and `atoms-dir`
pointing to finalized `*.atom.json` output. The Action copies only those atom files into your fork,
assembles a prospective index to reject unresolved services, and opens a PR targeting upstream
`main`. Its branch and PR title/body are specified in [README.md](README.md#atom-registration).
You do not need an upstream write token. If assembly fails, fix the source plugin or its required
service before submitting again.

The PR must contain only generated `atoms/*.atom.json` changes. Do not add a `.b3`, `index.json`,
`index.json.sig`, or hand-edited atom. Reviewers check the atom's package links, publisher identity,
service requirements, DCO sign-off, and the prospective assembly check. The Action signs off its
generated atom commit; hand-authored commits need your own sign-off as described below.

## Develop

```sh
bash scripts/check.sh
```

Run it before every push; CI runs the same gate.

## Constraints

- The maintainer owns git history and releases; submit tooling changes as a pull request against `dev`.
  Generated atom submissions target `main` through the registration Action.
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
