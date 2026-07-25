# main-index: instructions for AI assistants

You are working in `main-index`, the org's published plugin index. Bespok3d is a printer-agnostic plugin
manager for Klipper printers that runs on stock firmware. This repo is the registry the Bespok3d desktop
app reads to discover and install plugins. Its published data is assembled and signed by tooling, not
hand-authored. This file is the contract for any LLM or agent that edits this repo. Contributors here
often work with AI assistance, so the rules and the design intent are written down and enforced in the
gate, not left implicit.

If you are a non-Claude tool, `AGENTS.md` points you here.

## What this repo ships

Read `README.md` for the full assembly model. In short:

- The index of lists (`index.json`) and its detached signature (`index.json.sig`), the leaf sub-lists, and
  the per-plugin atoms under `atoms/`. These are the registry the app reads.
- `keys/`: the org registry public key (`bespok3d-list.pub.asc`) a client verifies the index against.
- `scripts/`: the assemble, sign, and verify tooling, plus its tests.

## The hard rule: do NOT hand-edit the generated, signed data

`index.json`, `index.json.sig`, the sub-lists, and the atoms under `atoms/` are GENERATED from the plugin
repos by the `b3-builder` Action and signed with the org registry key. Editing any of them by hand either
breaks the signature or drifts the index away from its source of truth. A plugin joins or updates the index
through its own release, never through a manual entry here. If the index is wrong, the fix is in the plugin
repo or in this repo's assembly tooling, not in the data.

The real work in this repo is the **tooling** (`scripts/`): the assemble, sign, and verify steps and their
tests. That is what you change here.

## The non-negotiables

1. **RULE ZERO: no em-dash or en-dash, anywhere** (code, comments, docs, commit messages). Use a comma,
   colon, semicolon, parentheses, or two sentences. A hyphen in a compound word is fine. The gate's
   em-dash guard fails the build on a violation, and it covers `scripts/`, `atoms/`, the lists,
   `index.json`, and this README.
2. **Every identifier carries domain meaning.** A name says what the thing *is* in the domain, never its
   type, its position, or a role-free abbreviation.
3. **Nesting beyond one level is suspicious.** Flatten by default.
4. **Rule of three.** The third copy of a block, shape, or constant gets extracted.
5. **Never commit a real secret.** The private registry key never enters this repo; only the public key
   ships. Fixtures are obviously fake.

## How to work a change

1. **Understand first.** Read `README.md` and the tooling you are changing. If the intent is unclear, ask
   one specific question and stop.
2. **Scope it to a user story** and implement only what it needs.
3. **Write the change** to the rules above.
4. **Run the gate and make it green:** `bash scripts/check.sh`. It runs `node --test` over the assemble,
   assemble-sign, verify-index, and verify-lists tooling, the workflow-pinning check, the em-dash guard
   over `scripts/` + `atoms/` + the lists + `index.json` + this README, and shellcheck. The gate uses the
   shared detectors, so it needs the `lib_bespok3d` repo checked out as a workspace sibling (at
   `../lib_bespok3d`); clone it alongside this repo before running the gate.
5. **On a gate failure, fix the cause.** Never hand-wave a real smell away. If a detector is genuinely
   wrong about a line, the fix is a per-instance justified allow at the smell
   (`# gate-allow <metric>: <reason>`, with a reason that survives "why is THIS one ok?"), never a blanket
   mute.
6. **Add a regression test** in the same change: a `node --test` case that fails on the old behavior and
   passes on the fix.
7. **Keep the docs current.** If you change how the index is assembled, signed, or verified, update
   `README.md`.

## Hard constraints

- **Never run git.** The maintainer commits. Leave the tree green and hand over exact commands if a git
  action is needed.
- **Never hand-edit the generated, signed data** (`index.json`, `index.json.sig`, the sub-lists, the
  atoms). Change the tooling or the source plugin, then let assembly regenerate them.
- **The gate must be green** before a change is considered done.

## When you are unsure

Ask one specific question and stop. Do not guess and implement. The architecture is the maintainer's; your
job is to implement it to the rules above.
