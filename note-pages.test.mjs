import assert from 'node:assert/strict'
import test from 'node:test'

import { notePageCount, notesForPage } from './lib/note-pages.mjs'

test('notesForPage returns a bounded newest-first slice and page count', () => {
  const notes = Array.from({ length: 161 }, (_, index) => ({ id: String(index) }))

  assert.equal(notePageCount(notes, 80), 3)
  assert.deepEqual(notesForPage(notes, 1, 80).map(note => note.id), ['160', '159', '158'].concat(Array.from({ length: 77 }, (_, index) => String(157 - index))))
  assert.deepEqual(notesForPage(notes, 3, 80).map(note => note.id), ['0'])
  assert.deepEqual(notesForPage(notes, 4, 80), [])
})
