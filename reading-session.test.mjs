import assert from 'node:assert/strict'
import test from 'node:test'

import {
  HISTORY_LIMIT,
  backEntry,
  emptyHistory,
  entryFor,
  forwardEntry,
  noteStem,
  parseHistory,
  parseProgress,
  progressFor,
  pushHistory,
  resolveNoteId,
  serializeHistory,
  serializeProgress,
  stepHistory,
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

test('entryFor mirrors a note into a history entry', () => {
  assert.deepEqual(entryFor({ id: 'a/b/2026-01-01-x', title: { en: 'X', zh: '叉' } }, 'zh'), {
    id: 'a/b/2026-01-01-x',
    stem: '2026-01-01-x',
    title: '叉',
    language: 'zh',
  })
})

test('progressFor captures the note, language, and revision that produced it', () => {
  assert.deepEqual(
    progressFor({ id: 'implemented/feature/2026-09-30-x', title: { en: 'X', zh: '叉' } }, 'en', '5badb150', 1759700000000),
    { id: 'implemented/feature/2026-09-30-x', stem: '2026-09-30-x', title: 'X', language: 'en', revision: '5badb150', openedAt: 1759700000000 },
  )
})

test('pushHistory appends, ignores a repeat of the current entry, and truncates the forward tail', () => {
  const first = entryFor({ id: 'a/b/2026-01-01-first', title: { en: 'First' } }, 'en')
  const second = entryFor({ id: 'a/b/2026-01-02-second', title: { en: 'Second' } }, 'en')
  const third = entryFor({ id: 'a/b/2026-01-03-third', title: { en: 'Third' } }, 'en')

  let state = emptyHistory()
  assert.deepEqual(state, { entries: [], cursor: -1 })
  assert.equal(backEntry(state), null)
  assert.equal(forwardEntry(state), null)

  state = pushHistory(state, first)
  state = pushHistory(state, second)
  state = pushHistory(state, third)
  assert.equal(state.cursor, 2)

  assert.deepEqual(pushHistory(state, third), state, 'the current entry is not pushed twice')

  state = stepHistory(state, -1, () => true).state
  assert.equal(state.cursor, 1)
  const branched = pushHistory(state, first)
  assert.deepEqual(branched.entries.map(entry => entry.id), [first.id, second.id, first.id], 'the forward tail is dropped')
  assert.equal(branched.cursor, 2)
})

test('pushHistory caps the stack without breaking the cursor', () => {
  let state = emptyHistory()
  for (let index = 0; index < HISTORY_LIMIT + 20; index += 1) {
    state = pushHistory(state, entryFor({ id: `a/b/2026-01-01-n${index}`, title: { en: `N${index}` } }, 'en'))
  }
  assert.equal(state.entries.length, HISTORY_LIMIT)
  assert.equal(state.cursor, HISTORY_LIMIT - 1)
  assert.equal(state.entries.at(-1).id, `a/b/2026-01-01-n${HISTORY_LIMIT + 19}`)
})

test('stepHistory walks past entries whose Notes are gone and reports when nothing is left', () => {
  const live = entryFor({ id: 'a/b/2026-01-01-live', title: { en: 'Live' } }, 'en')
  const gone = entryFor({ id: 'a/b/2026-01-02-gone', title: { en: 'Gone' } }, 'en')
  const current = entryFor({ id: 'a/b/2026-01-03-current', title: { en: 'Current' } }, 'en')
  let state = emptyHistory()
  state = pushHistory(state, live)
  state = pushHistory(state, gone)
  state = pushHistory(state, current)

  const stepped = stepHistory(state, -1, entry => entry.id === live.id)
  assert.equal(stepped.entry?.id, live.id)
  assert.equal(stepped.state.cursor, 0)

  const stuck = stepHistory(state, -1, () => false)
  assert.equal(stuck.entry, null)
  assert.deepEqual(stuck.state, state, 'a failed step leaves the cursor where it was')
})

test('backEntry and forwardEntry describe the neighbours without moving', () => {
  const first = entryFor({ id: 'a/b/2026-01-01-first', title: { en: 'First' } }, 'en')
  const second = entryFor({ id: 'a/b/2026-01-02-second', title: { en: 'Second' } }, 'en')
  let state = pushHistory(emptyHistory(), first)
  state = pushHistory(state, second)

  assert.equal(backEntry(state)?.id, first.id)
  assert.equal(forwardEntry(state), null)
  state = stepHistory(state, -1, () => true).state
  assert.equal(forwardEntry(state)?.id, second.id)
  assert.equal(backEntry(state), null)
})

test('history round-trips and a corrupt payload degrades to an empty stack', () => {
  let state = pushHistory(emptyHistory(), entryFor({ id: 'a/b/2026-01-01-first', title: { en: 'First' } }, 'en'))
  state = pushHistory(state, entryFor({ id: 'a/b/2026-01-02-second', title: { en: 'Second' } }, 'en'))
  assert.deepEqual(parseHistory(serializeHistory(state)), state)

  assert.deepEqual(parseHistory(null), emptyHistory())
  assert.deepEqual(parseHistory('{'), emptyHistory())
  assert.deepEqual(parseHistory(JSON.stringify({ entries: 'nope', cursor: 3 })), emptyHistory())
  assert.deepEqual(
    parseHistory(JSON.stringify({ entries: [{ id: 'a/b/2026-01-01-first' }], cursor: 99 })),
    emptyHistory(),
    'a cursor outside the stack is not trusted',
  )
})
