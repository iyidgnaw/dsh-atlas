import { Explorer } from './_components/explorer'
import { getCatalog } from '@/lib/catalog'
import { isPublicSite, siteUrl } from '@/lib/site'
import type { ExplorerCatalog } from '@/lib/types'

export default async function HomePage() {
  const catalog = await getCatalog()
  const explorerCatalog: ExplorerCatalog = {
    sourceRepository: catalog.sourceRepository,
    sourceBranch: catalog.sourceBranch,
    sourceRevision: catalog.sourceRevision,
    skills: catalog.skills.map(skill => ({ id: skill.id, name: skill.name, group: skill.group, title: skill.title, workflow: skill.workflow, description: skill.description, sourcePath: skill.sourcePath, content: skill.content })),
    notes: catalog.notes.map(note => ({ id: note.id, date: note.date, lifecycle: note.lifecycle, category: note.category, status: note.status, archived: note.archived, sourcePath: note.sourcePath, title: note.title, statusLine: note.statusLine, summary: note.summary, sourceWarnings: note.sourceWarnings, bodyPath: note.bodyPath })),
  }
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'DeepSeek Harness Atlas',
    ...(isPublicSite ? { url: siteUrl } : {}),
    description: 'A visual field guide to DeepSeek Harness skills, architecture, and decisions.',
    inLanguage: ['en', 'zh-CN'],
    about: {
      '@type': 'SoftwareSourceCode',
      name: 'DeepSeek Harness',
      codeRepository: catalog.sourceRepository,
    },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll('<', '\\u003c') }} />
      <Explorer catalog={explorerCatalog} />
    </>
  )
}
