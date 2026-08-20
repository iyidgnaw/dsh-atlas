import { Explorer } from './_components/explorer'
import { JsonLd } from './_components/page-frame'
import { getCatalog } from '@/lib/catalog'
import { absoluteUrl, siteName, siteRepository } from '@/lib/site'
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
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': absoluteUrl('/'),
        name: siteName,
        url: absoluteUrl('/'),
        description: 'A visual field guide to DeepSeek Harness skills, architecture, and decisions.',
        inLanguage: ['en', 'zh-CN'],
        author: { '@type': 'Person', name: 'iyidgnaw', url: 'https://github.com/iyidgnaw' },
        about: { '@type': 'SoftwareSourceCode', name: 'DeepSeek Harness', codeRepository: catalog.sourceRepository },
        hasPart: [
          { '@type': 'CollectionPage', name: 'All Agent Notes', url: absoluteUrl('/notes') },
          { '@type': 'CollectionPage', name: 'Repository Skills', url: absoluteUrl('/skills') },
        ],
      },
      {
        '@type': 'Dataset',
        name: 'DeepSeek Harness Agent Notes',
        description: `${catalog.notes.length} bilingual English/Chinese decision records and ${catalog.skills.length} repository Skills, generated from ${catalog.sourceRepository} at revision ${catalog.sourceRevision}.`,
        url: absoluteUrl('/notes'),
        inLanguage: ['en', 'zh-CN'],
        license: 'https://opensource.org/licenses/MIT',
        isBasedOn: catalog.sourceRepository,
        creator: { '@type': 'Person', name: 'iyidgnaw', url: 'https://github.com/iyidgnaw' },
        distribution: { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: absoluteUrl('/data/catalog.json') },
        codeRepository: siteRepository,
      },
    ],
  }

  return (
    <>
      <JsonLd data={structuredData} />
      <Explorer catalog={explorerCatalog} />
    </>
  )
}
