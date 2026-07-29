// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// A plugin release pushes its atoms into this repo through the register-atoms action. Cloning with no
// branch lands them on the repo's default branch, which is not the branch assembly signs and the app
// reads, so the store keeps serving a stale index while every release looks green.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const registerAtoms = readFileSync(join(repoRoot, '.github/actions/register-atoms/action.yml'), 'utf-8')

test('atoms are pushed to the branch the app reads, not the default branch', () => {
  assert.match(registerAtoms, /git clone --branch main "https:\/\/x-access-token:/)
})

test('the push retry rebases onto the branch that was checked out', () => {
  assert.match(registerAtoms, /git pull --rebase --no-edit origin main/)
})
