import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { reconcileRecords, scanNotes } from './build.mjs'

async function writePair(root, relative, status = 'implemented') {
  const english = path.join(root, `${relative}.md`)
  const chinese = path.join(root, `${relative}.zh.md`)
  await mkdir(path.dirname(english), { recursive: true })
  await writeFile(english, `# Agent Note: English title\n\nStatus: ${status}\n\n## Problem\nEnglish problem.\n`)
  await writeFile(chinese, `# Agent Note: 中文标题\n\nStatus: ${status}\n\n## Problem\n中文问题。\n`)
}

test('scanNotes includes complete canonical pairs and reports every excluded Markdown path', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-notes-'))
  await writePair(root, 'implemented/feature/2026-08-20-valid-note')
  await writeFile(path.join(root, 'README.md'), '# metadata')
  await mkdir(path.join(root, 'implemented'), { recursive: true })
  await writeFile(path.join(root, 'implemented', 'AGENTS.md'), '# instructions')
  await symlink('AGENTS.md', path.join(root, 'implemented', 'CLAUDE.md'))

  const inventory = await scanNotes(root)

  assert.equal(inventory.records.length, 1)
  assert.deepEqual(inventory.excluded.map(item => item.path), [
    'README.md',
    'implemented/AGENTS.md',
    'implemented/CLAUDE.md',
  ])
  assert.equal(inventory.invalid.length, 0)
  assert.equal(inventory.records[0].title.en, 'English title')
  assert.equal(inventory.records[0].title.zh, '中文标题')
})

test('scanNotes rejects a note-shaped file when its Chinese counterpart is missing', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dsh-notes-'))
  const english = path.join(root, 'proposed', 'architecture', '2026-08-20-unpaired.md')
  await mkdir(path.dirname(english), { recursive: true })
  await writeFile(english, '# Agent Note: Unpaired\n\nStatus: proposed\n\n## Problem\nMissing pair.\n')

  const inventory = await scanNotes(root)

  assert.equal(inventory.records.length, 0)
  assert.deepEqual(inventory.invalid, [{
    path: 'proposed/architecture/2026-08-20-unpaired',
    reason: 'missing Chinese counterpart',
  }])
})

test('reconcileRecords reports missing, extra, duplicate, and changed generated notes', () => {
  const source = [
    { id: 'a', hashes: { en: 'en-a', zh: 'zh-a' } },
    { id: 'b', hashes: { en: 'en-b', zh: 'zh-b' } },
  ]
  const generated = [
    { id: 'a', hashes: { en: 'changed', zh: 'zh-a' } },
    { id: 'a', hashes: { en: 'en-a', zh: 'zh-a' } },
    { id: 'c', hashes: { en: 'en-c', zh: 'zh-c' } },
  ]

  assert.deepEqual(reconcileRecords(source, generated), {
    missing: ['b'],
    extra: ['c'],
    duplicate: ['a'],
    hashMismatch: ['a'],
  })
})
