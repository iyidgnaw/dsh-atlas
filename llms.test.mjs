import assert from 'node:assert/strict'
import test from 'node:test'

import { llmsText } from './lib/llms.mjs'

const catalog = {
  sourceRepository: 'https://github.com/deepseek-ai/deepseek-harness',
  sourceBranch: 'master',
  sourceRevision: '1600d8a1e140dcde43a1a0941940a0480712c011',
  skills: [
    { id: 'dsh-code-review', name: 'dsh-code-review', group: 'Review', title: 'Code review', workflow: ['Read'], description: 'Review a diff.', sourcePath: '.agents/skills/dsh-code-review/SKILL.md', hash: 'a', bodyPath: '/data/skills/dsh-code-review.json' },
  ],
  notes: [
    { id: 'archived/feature/2026-07-06-sandbox', date: '2026-07-06', lifecycle: 'archived', category: 'feature', status: 'archived', archived: true, sourcePath: '.agents/notes/archived/feature/2026-07-06-sandbox.md', title: { en: 'Sandbox', zh: '沙箱' }, statusLine: { en: 'Archived', zh: '已归档' }, summary: { en: 'A sandbox.', zh: '一个沙箱。' }, sourceWarnings: [], bodyPath: '/data/notes/archived/feature/2026-07-06-sandbox.json' },
    { id: 'implemented/architecture/2026-09-11-sandboxed-node-ptc-runtime', date: '2026-09-11', lifecycle: 'implemented', category: 'architecture', status: 'implemented', archived: false, sourcePath: '.agents/notes/implemented/architecture/2026-09-11-sandboxed-node-ptc-runtime.md', title: { en: 'Sandboxed runtime', zh: '沙箱运行时' }, statusLine: { en: 'Implemented', zh: '已实现' }, summary: { en: 'A runtime.', zh: '一个运行时。' }, sourceWarnings: [], bodyPath: '/data/notes/implemented/architecture/2026-09-11-sandboxed-node-ptc-runtime.json' },
  ],
}

const text = llmsText({ catalog, siteUrl: 'https://example.test' })

test('llmsText opens with the site name and its DSH Atlas alias', () => {
  assert.match(text, /^# DeepSeek Harness Atlas \(DSH Atlas\)$/m)
})

test('llmsText links the indexes, the Skills, and the machine-readable catalog', () => {
  assert.match(text, /\(https:\/\/example\.test\/notes\)/)
  assert.match(text, /\(https:\/\/example\.test\/skills\)/)
  assert.match(text, /\(https:\/\/example\.test\/data\/catalog\.json\)/)
  assert.match(text, /\(https:\/\/example\.test\/skills\/dsh-code-review\)/)
})

test('llmsText states the corpus facts an assistant can quote', () => {
  assert.match(text, /2 bilingual Agent Notes/)
  assert.match(text, /1 repository Skills/)
  assert.match(text, /1600d8a1e140/)
  assert.match(text, /2026-07-06 to 2026-09-11/)
})

test('llmsText points at the Notes index rather than dumping 1266 Note URLs', () => {
  assert.ok(!text.includes('2026-07-06-sandbox'), 'per-Note URLs belong in the sitemap, not here')
})
