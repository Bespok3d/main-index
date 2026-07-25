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
