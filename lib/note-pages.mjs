export function notePageCount(notes, pageSize) {
  return Math.ceil(notes.length / pageSize)
}

export function notesForPage(notes, page, pageSize) {
  const newestFirst = [...notes].reverse()
  const start = (page - 1) * pageSize
  return newestFirst.slice(start, start + pageSize)
}
