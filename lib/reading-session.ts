import type { Language } from './types'

/**
 * The reader's session: where they stopped reading, and the path they took to get there.
 *
 * Kept free of React and of each other's imports so it can be exercised by `node --test`, which
 * strips types but does not resolve extensionless TypeScript specifiers.
 */

export const READING_PROGRESS_KEY = 'dsh-atlas:reading:v1'
export const NOTE_HISTORY_KEY = 'dsh-atlas:history:v1'
export const HISTORY_LIMIT = 50

/**
 * Upstream moves a Note between lifecycle directories when it archives one, which rewrites the
 * `lifecycle/category/stem` id out from under anything that remembered it. The stem survives.
 */
export function noteStem(id: string) {
  return id.split('/').slice(2).join('/')
}

export interface NoteRef {
  id: string
  stem?: string
}

export interface ReadingProgress {
  id: string
  stem: string
  title: string
  language: Language
  revision: string
  openedAt: number
}

export interface HistoryEntry {
  id: string
  stem: string
  title: string
  language: Language
}

export interface HistoryState {
  entries: HistoryEntry[]
  cursor: number
}

function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'zh'
}

function isFilledString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function parseEntry(value: unknown): HistoryEntry | null {
  if (!value || typeof value !== 'object') return null
  const { id, stem, title, language } = value as Record<string, unknown>
  if (!isFilledString(id) || !isFilledString(stem) || !isFilledString(title) || !isLanguage(language)) return null
  return { id, stem, title, language }
}

export function emptyHistory(): HistoryState {
  return { entries: [], cursor: -1 }
}

/** The live id for a remembered reference, following the Note when it moves between lifecycles. */
export function resolveNoteId(reference: NoteRef, notes: readonly { id: string }[]) {
  const exact = notes.find(note => note.id === reference.id)
  if (exact) return exact.id
  if (!reference.stem) return null
  const moved = notes.find(note => noteStem(note.id) === reference.stem)
  return moved ? moved.id : null
}

export function entryFor(note: { id: string; title: Record<Language, string> }, language: Language): HistoryEntry {
  return { id: note.id, stem: noteStem(note.id), title: note.title[language], language }
}

export function progressFor(note: { id: string; title: Record<Language, string> }, language: Language, revision: string, openedAt: number): ReadingProgress {
  return { id: note.id, stem: noteStem(note.id), title: note.title[language], language, revision, openedAt }
}

export function pushHistory(state: HistoryState, entry: HistoryEntry): HistoryState {
  if (state.entries[state.cursor]?.id === entry.id) return state
  const entries = [...state.entries.slice(0, state.cursor + 1), entry].slice(-HISTORY_LIMIT)
  return { entries, cursor: entries.length - 1 }
}

export function backEntry(state: HistoryState): HistoryEntry | null {
  return state.cursor > 0 ? state.entries[state.cursor - 1] : null
}

export function forwardEntry(state: HistoryState): HistoryEntry | null {
  return state.cursor >= 0 && state.cursor < state.entries.length - 1 ? state.entries[state.cursor + 1] : null
}

/**
 * Move one step through the history, passing over entries whose Note no longer exists. A step that
 * finds nothing leaves the cursor untouched, so one dead reference cannot disable the control.
 */
export function stepHistory(state: HistoryState, direction: -1 | 1, isValid: (entry: HistoryEntry) => boolean): { state: HistoryState; entry: HistoryEntry | null } {
  for (let cursor = state.cursor + direction; cursor >= 0 && cursor < state.entries.length; cursor += direction) {
    if (isValid(state.entries[cursor])) return { state: { ...state, cursor }, entry: state.entries[cursor] }
  }
  return { state, entry: null }
}

export function parseProgress(raw: string | null): ReadingProgress | null {
  if (!raw) return null
  let value: unknown
  try { value = JSON.parse(raw) } catch { return null }
  if (!value || typeof value !== 'object') return null
  const { id, stem, title, language, revision, openedAt } = value as Record<string, unknown>
  if (!isFilledString(id) || !isFilledString(stem) || !isFilledString(title) || !isFilledString(revision)) return null
  if (!isLanguage(language) || typeof openedAt !== 'number' || !Number.isFinite(openedAt)) return null
  return { id, stem, title, language, revision, openedAt }
}

export function serializeProgress(progress: ReadingProgress) {
  return JSON.stringify(progress)
}

export function parseHistory(raw: string | null): HistoryState {
  if (!raw) return emptyHistory()
  let value: unknown
  try { value = JSON.parse(raw) } catch { return emptyHistory() }
  if (!value || typeof value !== 'object') return emptyHistory()
  const { entries, cursor } = value as Record<string, unknown>
  if (!Array.isArray(entries) || typeof cursor !== 'number' || !Number.isInteger(cursor)) return emptyHistory()
  const parsed: HistoryEntry[] = []
  for (const entry of entries) {
    const record = parseEntry(entry)
    if (!record) return emptyHistory()
    parsed.push(record)
  }
  if (cursor < -1 || cursor > parsed.length - 1) return emptyHistory()
  const overflow = Math.max(0, parsed.length - HISTORY_LIMIT)
  return { entries: parsed.slice(overflow), cursor: cursor - overflow }
}

export function serializeHistory(state: HistoryState) {
  return JSON.stringify(state)
}

/**
 * Storage is best-effort: a private window, a full quota, or a browser with site data blocked
 * throws on access, and the atlas still has to render.
 */
function readStoredProgress(): ReadingProgress | null {
  if (typeof window === 'undefined') return null
  try { return parseProgress(window.localStorage.getItem(READING_PROGRESS_KEY)) } catch { return null }
}

function readStoredHistory(): HistoryState {
  if (typeof window === 'undefined') return emptyHistory()
  try { return parseHistory(window.localStorage.getItem(NOTE_HISTORY_KEY)) } catch { return emptyHistory() }
}

function write(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(key, value) } catch { /* storage unavailable */ }
}

/**
 * A `useSyncExternalStore` source. The server renders the empty snapshot and the browser swaps in
 * the stored one after hydration, so the prerendered markup and the first client render agree
 * without reading storage during render.
 */
const EMPTY_HISTORY: HistoryState = { entries: [], cursor: -1 }
const listeners = new Set<() => void>()
let progressSnapshot: ReadingProgress | null = null
let historySnapshot: HistoryState = EMPTY_HISTORY
let loaded = false

function load() {
  if (loaded) return
  loaded = true
  progressSnapshot = readStoredProgress()
  historySnapshot = readStoredHistory()
}

export function subscribeReading(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function getProgressSnapshot() {
  load()
  return progressSnapshot
}

export function getHistorySnapshot() {
  load()
  return historySnapshot
}

export function getProgressServerSnapshot(): ReadingProgress | null {
  return null
}

export function getHistoryServerSnapshot(): HistoryState {
  return EMPTY_HISTORY
}

/** Remember a Note the reader just opened as the position to come back to. */
export function rememberReading(note: { id: string; title: Record<Language, string> }, language: Language, revision: string) {
  setProgress(progressFor(note, language, revision, Date.now()))
}

export function setProgress(next: ReadingProgress | null) {
  load()
  progressSnapshot = next
  if (next) write(READING_PROGRESS_KEY, serializeProgress(next))
  for (const listener of [...listeners]) listener()
}

export function setHistory(next: HistoryState) {
  load()
  historySnapshot = next
  write(NOTE_HISTORY_KEY, serializeHistory(next))
  for (const listener of [...listeners]) listener()
}
