import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { cache } from 'react'

import type { Catalog, Language, NoteBodyRecord, NoteMetadata, SkillRecord } from './types'

const dataRoot = path.join(process.cwd(), 'public')

export const getCatalog = cache(async (): Promise<Catalog> => {
  const source = await readFile(path.join(dataRoot, 'data', 'catalog.json'), 'utf8')
  return JSON.parse(source) as Catalog
})

export const getNoteBody = cache(async (bodyPath: string): Promise<NoteBodyRecord> => {
  const source = await readFile(path.join(dataRoot, bodyPath.replace(/^\//, '')), 'utf8')
  return JSON.parse(source) as NoteBodyRecord
})

export const getNote = cache(async (id: string): Promise<NoteMetadata | undefined> => {
  const catalog = await getCatalog()
  return catalog.notes.find(note => note.id === id)
})

export const getSkill = cache(async (name: string): Promise<SkillRecord | undefined> => {
  const catalog = await getCatalog()
  return catalog.skills.find(skill => skill.name === name)
})

/** Maps every upstream Note path — English and Chinese — to the Atlas route that renders it. */
export const getNotePathIndex = cache(async (): Promise<Record<string, { id: string; language: Language }>> => {
  const catalog = await getCatalog()
  return Object.fromEntries(catalog.notes.flatMap(note => [
    [note.sourcePath, { id: note.id, language: 'en' as const }],
    [note.sourcePath.replace(/\.md$/, '.zh.md'), { id: note.id, language: 'zh' as const }],
  ]))
})

export function noteHref(id: string) {
  return `/notes/${id}`
}

export function skillHref(name: string) {
  return `/skills/${name}`
}
