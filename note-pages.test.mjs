import assert from 'node:assert/strict'
import test from 'node:test'

import { notePageCount, notePageHref, notesForPage, notesIndexStructuredData, notesPerPage } from './lib/note-pages.mjs'

const url = path => `https://example.test${path}`

test('notesForPage returns a bounded newest-first slice and page count', () => {
  const notes = Array.from({ length: 161 }, (_, index) => ({ id: String(index) }))

  assert.equal(notePageCount(notes, 80), 3)
  assert.deepEqual(notesForPage(notes, 1, 80).map(note => note.id), ['160', '159', '158'].concat(Array.from({ length: 77 }, (_, index) => String(157 - index))))
  assert.deepEqual(notesForPage(notes, 3, 80).map(note => note.id), ['0'])
  assert.deepEqual(notesForPage(notes, 4, 80), [])
})

test('notePageHref keeps the first page at /notes and gives later pages their own URL', () => {
  assert.equal(notesPerPage, 80)
  assert.equal(notePageHref(1), '/notes')
  assert.equal(notePageHref(2), '/notes/page/2')
  assert.equal(notePageHref(15), '/notes/page/15')
})

test('notesIndexStructuredData describes the page it is on, not the whole corpus', () => {
  const graph = notesIndexStructuredData({ page: 2, pageNoteCount: 80, siteName: 'DeepSeek Harness Atlas', description: 'Every Agent Note.', url })['@graph']

  assert.deepEqual(graph.map(node => node['@type']), ['CollectionPage', 'BreadcrumbList'])
  assert.equal(graph[0].mainEntity.numberOfItems, 80)
  assert.equal(graph[0].url, 'https://example.test/notes/page/2')
  assert.equal(graph[1].itemListElement.length, 3)
  assert.equal(graph[1].itemListElement.at(-1).item, 'https://example.test/notes/page/2')
})

test('notesIndexStructuredData keeps the first page unnamed and its trail two deep', () => {
  const graph = notesIndexStructuredData({ page: 1, pageNoteCount: 80, siteName: 'DeepSeek Harness Atlas', description: 'Every Agent Note.', url })['@graph']

  assert.equal(graph[0].name, 'All Agent Notes | DeepSeek Harness Atlas')
  assert.equal(graph[0].url, 'https://example.test/notes')
  assert.equal(graph[1].itemListElement.length, 2)
})
