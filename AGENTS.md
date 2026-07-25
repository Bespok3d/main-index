# AGENTS.md

This repo's contributor rules for AI assistants live in [CLAUDE.md](CLAUDE.md). They are tool-agnostic:
read that file and follow it, whatever assistant you are.

Short version: `main-index` is the org's published plugin index. Its data (`index.json`, `index.json.sig`,
the sub-lists, and the atoms) is GENERATED and SIGNED by the `b3-builder` Action, so never hand-edit it: a
plugin joins the index through its own release, and the work you do here is the assembly tooling in
`scripts/`. Clone `lib_bespok3d` as a workspace sibling, run `bash scripts/check.sh`, and make it green
(fix a real failure, never mute it). Keep every identifier meaningful, nesting shallow, and em-dashes out.
