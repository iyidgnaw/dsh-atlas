import assert from 'node:assert/strict'
import test from 'node:test'

import {
  noteStem,
  parseProgress,
  resolveNoteId,
  serializeProgress,
} from './lib/reading-session.ts'

const notes = [
  { id: 'archived/architecture/2026-06-11-content-block-vocabulary' },
  { id: 'implemented/feature/2026-09-30-session-list-host-fairness' },
]

const progress = {
  id: 'implemented/feature/2026-09-30-session-list-host-fairness',
  stem: '2026-09-30-session-list-host-fairness',
  title: 'Time-sliced Session-list work',
  language: 'en',
  revision: '5badb15009ae1756c3afe0ae0cef1faafc290ccc',
  openedAt: 1759700000000,
}

test('noteStem keeps the half of an id that survives an archive move', () => {
  assert.equal(noteStem('implemented/architecture/2026-06-11-content-block-vocabulary'), '2026-06-11-content-block-vocabulary')
  assert.equal(noteStem('archived/architecture/2026-06-11-content-block-vocabulary'), '2026-06-11-content-block-vocabulary')
  assert.equal(noteStem('nonsense'), '')
})

test('resolveNoteId prefers an exact id and falls back to the stem after a lifecycle move', () => {
  assert.equal(resolveNoteId(progress, notes), 'implemented/feature/2026-09-30-session-list-host-fairness')
  const moved = { id: 'implemented/architecture/2026-06-11-content-block-vocabulary', stem: '2026-06-11-content-block-vocabulary' }
  assert.equal(resolveNoteId(moved, notes), 'archived/architecture/2026-06-11-content-block-vocabulary')
  assert.equal(resolveNoteId({ id: 'implemented/feature/2026-01-01-deleted', stem: '2026-01-01-deleted' }, notes), null)
})

test('parseProgress rejects anything that is not a complete record', () => {
  assert.equal(parseProgress(null), null)
  assert.equal(parseProgress('not json'), null)
  assert.equal(parseProgress('[]'), null)
  assert.equal(parseProgress(JSON.stringify({ ...progress, language: 'fr' })), null)
  assert.equal(parseProgress(JSON.stringify({ ...progress, title: '' })), null)
  assert.equal(parseProgress(JSON.stringify({ ...progress, openedAt: 'yesterday' })), null)
  assert.deepEqual(parseProgress(serializeProgress(progress)), progress)
})
