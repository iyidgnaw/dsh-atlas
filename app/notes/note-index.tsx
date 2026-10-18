import Link from 'next/link'

import { Breadcrumbs, JsonLd, PageFrame } from '@/app/_components/page-frame'
import { noteHref } from '@/lib/catalog'
import { notePageCount, notesForPage } from '@/lib/note-pages.mjs'
import { absoluteUrl, siteName } from '@/lib/site'
import type { Catalog, NoteMetadata } from '@/lib/types'

export const notesPerPage = 80
const description = 'Every DeepSeek Harness Agent Note as its own page: architecture, features, bug fixes, process, simplification, and testing decisions, in English and Chinese.'

function monthLabel(date: string) {
  return new Date(`${date.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function pageHref(page: number) {
  return page === 1 ? '/notes' : `/notes/page/${page}`
}

export function NotesIndex({ catalog, page }: { catalog: Catalog; page: number }) {
  const notes = notesForPage(catalog.notes, page, notesPerPage)
  const pages = notePageCount(catalog.notes, notesPerPage)
  const months = notes.reduce<Array<{ key: string; notes: NoteMetadata[] }>>((groups, note) => {
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
  const pathname = pageHref(page)

  return (
    <>
      <JsonLd data={{ '@context': 'https://schema.org', '@graph': [{ '@type': 'CollectionPage', name: `All Agent Notes${page === 1 ? '' : ` — Page ${page}`} | ${siteName}`, description, url: absoluteUrl(pathname), inLanguage: ['en', 'zh-CN'], isPartOf: { '@type': 'WebSite', name: siteName, url: absoluteUrl('/') }, mainEntity: { '@type': 'ItemList', name: 'DeepSeek Harness Agent Notes', numberOfItems: catalog.notes.length } }], }} />
      <PageFrame active="notes" sourceRepository={catalog.sourceRepository} sourceBranch={catalog.sourceBranch} sourceRevision={catalog.sourceRevision} noteCount={catalog.notes.length}>
        <div className="shell index-head">
          <Breadcrumbs trail={[{ name: 'Atlas', href: '/' }, { name: 'Notes' }]} />
          <h1>All Agent Notes</h1>
          <p className="index-lede">{description} Browse the same corpus as an interactive timeline on the <Link href="/">Atlas home page</Link>.</p>
          <div className="metrics"><span className="metric"><b>{catalog.notes.length}</b> bilingual pairs</span><span className="metric"><b>{counts.implemented}</b> implemented</span><span className="metric"><b>{counts.rejected}</b> rejected</span><span className="metric"><b>{counts.proposed}</b> proposed</span></div>
        </div>
        <div className="shell index-list">
          {months.map(month => <section key={month.key}><h2 className="index-month">{monthLabel(month.key)}<span>{month.notes.length}</span></h2><ul>{month.notes.map(note => <li key={note.id} data-status={note.status} data-category={note.category}><Link href={noteHref(note.id)} prefetch={false}><span className="index-date">{note.date}</span><span className="index-title">{note.title.en}<span className="index-alt" lang="zh-Hans">{note.title.zh}</span></span><span className="index-badges"><span className="badge status">{note.status}</span><span className="badge category">{note.category}</span></span></Link></li>)}</ul></section>)}
          <nav className="document-nav" aria-label="Note pages">{page > 1 && <Link className="document-nav-link" href={pageHref(page - 1)}>← Newer Notes</Link>}<span>Page {page} of {pages}</span>{page < pages && <Link className="document-nav-link next" href={pageHref(page + 1)}>Older Notes →</Link>}</nav>
        </div>
      </PageFrame>
    </>
  )
}
