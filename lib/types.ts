export type Language = 'en' | 'zh'

export interface SkillRecord {
  id: string
  name: string
  group: string
  title: string
  workflow: string[]
  description: string
  sourcePath: string
  content: string
  hash: string
}

export interface NoteMetadata {
  id: string
  date: string
  lifecycle: 'implemented' | 'proposed' | 'rejected' | 'archived'
  category: 'feature' | 'bug-fix' | 'simplification' | 'architecture' | 'process' | 'testing'
  status: 'implemented' | 'proposed' | 'rejected'
  archived: boolean
  archivedDate: string
  sourcePath: string
  title: Record<Language, string>
  statusLine: Record<Language, string>
  summary: Record<Language, string>
  hashes: Record<Language, string>
  sourceWarnings: string[]
  bodyPath: string
}

export interface NoteBodyRecord {
  id: string
  hashes: Record<Language, string>
  content: Record<Language, string>
}

export interface Catalog {
  sourceRepository: string
  sourceBranch: 'master'
  sourceRevision: string
  skills: SkillRecord[]
  notes: NoteMetadata[]
}

export interface ExplorerCatalog {
  sourceRepository: string
  sourceBranch: 'master'
  sourceRevision: string
  skills: Array<Omit<SkillRecord, 'hash'>>
  notes: Array<Omit<NoteMetadata, 'hashes' | 'archivedDate'>>
}
