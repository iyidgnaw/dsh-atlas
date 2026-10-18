import assert from 'node:assert/strict'
import test from 'node:test'

import { conflictMarkerIssue } from './check-data.mjs'

test('conflictMarkerIssue reports a generated data file left with merge conflict markers', () => {
  const conflicted = '<<<<<<< HEAD\n{"a":1}\n=======\n{"a":2}\n>>>>>>> ebdb15b (perf: export atlas as static site)\n'

  assert.match(conflictMarkerIssue('catalog.json', conflicted), /merge conflict/)
})

test('conflictMarkerIssue accepts a clean generated data file', () => {
  assert.equal(conflictMarkerIssue('catalog.json', '{"sourceRevision":"1600d8a1e140"}\n'), null)
})

test('conflictMarkerIssue accepts a clean file that merely quotes a marker character', () => {
  assert.equal(conflictMarkerIssue('notes/a.json', '{"content":"a < b and c > d"}\n'), null)
})
