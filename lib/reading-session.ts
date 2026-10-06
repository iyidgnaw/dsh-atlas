import type { Language } from './types'

/**
 * The reader's session: where they stopped reading.
 *
 * Kept free of React and of each other's imports so it can be exercised by `node --test`, which
 * strips types but does not resolve extensionless TypeScript specifiers.
 */

export const READING_PROGRESS_KEY = 'dsh-atlas:reading:v1'

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

function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'zh'
}

function isFilledString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

/** The live id for a remembered reference, following the Note when it moves between lifecycles. */
export function resolveNoteId(reference: NoteRef, notes: readonly { id: string }[]) {
  const exact = notes.find(note => note.id === reference.id)
  if (exact) return exact.id
  if (!reference.stem) return null
  const moved = notes.find(note => noteStem(note.id) === reference.stem)
  return moved ? moved.id : null
}

export function progressFor(note: { id: string; title: Record<Language, string> }, language: Language, revision: string, openedAt: number): ReadingProgress {
  return { id: note.id, stem: noteStem(note.id), title: note.title[language], language, revision, openedAt }
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

/**
 * Storage is best-effort: a private window, a full quota, or a browser with site data blocked
 * throws on access, and the atlas still has to render.
 */
function readStoredProgress(): ReadingProgress | null {
  if (typeof window === 'undefined') return null
  try { return parseProgress(window.localStorage.getItem(READING_PROGRESS_KEY)) } catch { return null }
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
const listeners = new Set<() => void>()
let progressSnapshot: ReadingProgress | null = null
let loaded = false

function load() {
  if (loaded) return
  loaded = true
  progressSnapshot = readStoredProgress()
}

export function subscribeReading(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function getProgressSnapshot() {
  load()
  return progressSnapshot
}

export function getProgressServerSnapshot(): ReadingProgress | null {
  return null
}

export function setProgress(next: ReadingProgress | null) {
  load()
  progressSnapshot = next
  if (next) write(READING_PROGRESS_KEY, serializeProgress(next))
  for (const listener of [...listeners]) listener()
}

/** Remember a Note the reader just opened as the position to come back to. */
export function rememberReading(note: { id: string; title: Record<Language, string> }, language: Language, revision: string) {
  setProgress(progressFor(note, language, revision, Date.now()))
}
