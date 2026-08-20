import type { Metadata } from 'next'
import Link from 'next/link'

import { Breadcrumbs, JsonLd, PageFrame } from '@/app/_components/page-frame'
import { getCatalog, noteHref } from '@/lib/catalog'
import { absoluteUrl, isPublicSite, siteName } from '@/lib/site'
import type { NoteMetadata } from '@/lib/types'

const description = 'Every DeepSeek Harness Agent Note as its own page: architecture, features, bug fixes, process, simplification, and testing decisions, in English and Chinese.'

export const metadata: Metadata = {
  title: 'All Agent Notes',
  description,
  keywords: ['DeepSeek Harness', 'Agent Notes', 'architecture decision records', 'changelog', 'design decisions'],
  alternates: isPublicSite ? { canonical: '/notes' } : undefined,
  openGraph: { type: 'website', title: `All Agent Notes | ${siteName}`, description, siteName, url: isPublicSite ? '/notes' : undefined },
  twitter: { card: 'summary_large_image', title: `All Agent Notes | ${siteName}`, description },
}

function monthLabel(date: string) {
  return new Date(`${date.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export default async function NotesIndexPage() {
  const catalog = await getCatalog()
  const newestFirst = [...catalog.notes].reverse()
  const months = newestFirst.reduce<Array<{ key: string; notes: NoteMetadata[] }>>((groups, note) => {
    const key = note.date.slice(0, 7)
    const current = groups.at(-1)
    if (current?.key === key) current.notes.push(note)
    else groups.push({ key, notes: [note] })
    return groups
  }, [])
  const counts = {
    implemented: catalog.notes.filter(note => note.status === 'implemented').length,
    proposed: catalog.notes.filter(note => note.status === 'proposed').length,
    rejected: catalog.notes.filter(note => note.status === 'rejected').length,
  }

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: `All Agent Notes | ${siteName}`,
        description,
        url: absoluteUrl('/notes'),
        inLanguage: ['en', 'zh-CN'],
        isPartOf: { '@type': 'WebSite', name: siteName, url: absoluteUrl('/') },
        mainEntity: { '@type': 'ItemList', name: 'DeepSeek Harness Agent Notes', numberOfItems: catalog.notes.length },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: siteName, item: absoluteUrl('/') },
          { '@type': 'ListItem', position: 2, name: 'Agent Notes', item: absoluteUrl('/notes') },
        ],
      },
    ],
  }

  return (
    <>
      <JsonLd data={structuredData} />
      <PageFrame active="notes" sourceRepository={catalog.sourceRepository} sourceBranch={catalog.sourceBranch} sourceRevision={catalog.sourceRevision} noteCount={catalog.notes.length}>
        <div className="shell index-head">
          <Breadcrumbs trail={[{ name: 'Atlas', href: '/' }, { name: 'Notes' }]} />
          <h1>All Agent Notes</h1>
          <p className="index-lede">{description} Browse the same corpus as an interactive timeline on the <Link href="/">Atlas home page</Link>.</p>
          <div className="metrics">
            <span className="metric"><b>{catalog.notes.length}</b> bilingual pairs</span>
            <span className="metric"><b>{counts.implemented}</b> implemented</span>
            <span className="metric"><b>{counts.rejected}</b> rejected</span>
            <span className="metric"><b>{counts.proposed}</b> proposed</span>
          </div>
        </div>
        <div className="shell index-list">
          {months.map(month => (
            <section key={month.key}>
              <h2 className="index-month">{monthLabel(month.key)}<span>{month.notes.length}</span></h2>
              <ul>
                {month.notes.map(note => (
                  <li key={note.id} data-status={note.status} data-category={note.category}>
                    <Link href={noteHref(note.id)} prefetch={false}>
                      <span className="index-date">{note.date}</span>
                      <span className="index-title">{note.title.en}<span className="index-alt" lang="zh-Hans">{note.title.zh}</span></span>
                      <span className="index-badges"><span className="badge status">{note.status}</span><span className="badge category">{note.category}</span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </PageFrame>
    </>
  )
}
