import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Breadcrumbs, JsonLd, PageFrame } from '@/app/_components/page-frame'
import { RenderedMarkdown } from '@/app/_components/rendered-markdown'
import { getCatalog, getNote, getNoteBody, getNotePathIndex, noteHref } from '@/lib/catalog'
import { absoluteUrl, isPublicSite, metaDescription, siteName } from '@/lib/site'
import type { NoteMetadata } from '@/lib/types'

export const dynamicParams = false

interface NotePageProps {
  params: Promise<{ slug: string[] }>
}

export async function generateStaticParams() {
  const catalog = await getCatalog()
  return catalog.notes.map(note => ({ slug: note.id.split('/') }))
}

function summaryOf(note: NoteMetadata) {
  return note.summary.en || note.statusLine.en || note.title.en
}

export async function generateMetadata({ params }: NotePageProps): Promise<Metadata> {
  const { slug } = await params
  const note = await getNote(slug.join('/'))
  if (!note) return {}
  const description = metaDescription(summaryOf(note))
  const pathname = noteHref(note.id)
  return {
    title: note.title.en,
    description,
    keywords: ['DeepSeek Harness', 'Agent Note', note.category, note.status, note.archived ? 'archived decision' : 'active decision'],
    alternates: isPublicSite ? { canonical: pathname } : undefined,
    openGraph: {
      type: 'article',
      title: note.title.en,
      description,
      siteName,
      locale: 'en_US',
      alternateLocale: 'zh_CN',
      url: isPublicSite ? pathname : undefined,
      publishedTime: note.date,
      modifiedTime: note.archivedDate || note.date,
      tags: [note.category, note.status, note.lifecycle],
    },
    twitter: { card: 'summary_large_image', title: note.title.en, description },
  }
}

export default async function NotePage({ params }: NotePageProps) {
  const { slug } = await params
  const id = slug.join('/')
  const [catalog, note, notePathIndex] = await Promise.all([getCatalog(), getNote(id), getNotePathIndex()])
  if (!note) notFound()

  const body = await getNoteBody(note.bodyPath)
  const position = catalog.notes.findIndex(entry => entry.id === note.id)
  const previous = catalog.notes[position - 1]
  const next = catalog.notes[position + 1]
  const related = catalog.notes.filter(entry => entry.category === note.category && entry.id !== note.id).slice(-6).reverse()
  const sourceLink = `${catalog.sourceRepository}/blob/${catalog.sourceRevision}/${note.sourcePath}`

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        '@id': absoluteUrl(noteHref(note.id)),
        headline: note.title.en,
        alternativeHeadline: note.title.zh,
        description: summaryOf(note),
        datePublished: note.date,
        dateModified: note.archivedDate || note.date,
        inLanguage: ['en', 'zh-CN'],
        articleSection: note.category,
        keywords: [note.category, note.status, note.lifecycle].join(', '),
        isPartOf: { '@type': 'WebSite', name: siteName, url: absoluteUrl('/') },
        mainEntityOfPage: absoluteUrl(noteHref(note.id)),
        about: { '@type': 'SoftwareSourceCode', name: 'DeepSeek Harness', codeRepository: catalog.sourceRepository },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: siteName, item: absoluteUrl('/') },
          { '@type': 'ListItem', position: 2, name: 'Agent Notes', item: absoluteUrl('/notes') },
          { '@type': 'ListItem', position: 3, name: note.title.en, item: absoluteUrl(noteHref(note.id)) },
        ],
      },
    ],
  }

  return (
    <>
      <JsonLd data={structuredData} />
      <PageFrame active="notes" sourceRepository={catalog.sourceRepository} sourceBranch={catalog.sourceBranch} sourceRevision={catalog.sourceRevision} noteCount={catalog.notes.length}>
        <article className="shell document" data-status={note.status} data-category={note.category}>
          <Breadcrumbs trail={[{ name: 'Atlas', href: '/' }, { name: 'Notes', href: '/notes' }, { name: note.title.en }]} />
          <div className="note-meta">
            <span>{note.date}</span>
            <span className="badge status">{note.status}</span>
            <span className="badge category">{note.category}</span>
            {note.archived && <span className="badge">archived {note.archivedDate}</span>}
          </div>
          <h1>{note.title.en}</h1>
          <p className="document-alt" lang="zh-Hans">{note.title.zh}</p>
          <p className="document-summary">{summaryOf(note)}</p>
          <div className="source-path"><a href={sourceLink} target="_blank" rel="noreferrer">{note.sourcePath}</a></div>
          {note.sourceWarnings.length > 0 && <p className="source-warning">Source compatibility: {note.sourceWarnings.join('; ')}</p>}

          <section className="document-body" lang="en">
            <h2 className="language-rule">English</h2>
            <RenderedMarkdown sourcePath={note.sourcePath} sourceRepository={catalog.sourceRepository} sourceRevision={catalog.sourceRevision} notePathIndex={notePathIndex}>{body.content.en}</RenderedMarkdown>
          </section>

          <section className="document-body" lang="zh-Hans">
            <h2 className="language-rule">中文</h2>
            <RenderedMarkdown sourcePath={note.sourcePath.replace(/\.md$/, '.zh.md')} sourceRepository={catalog.sourceRepository} sourceRevision={catalog.sourceRevision} notePathIndex={notePathIndex}>{body.content.zh}</RenderedMarkdown>
          </section>

          <nav className="document-nav" aria-label="Adjacent Notes">
            {previous && <Link className="document-nav-link" href={noteHref(previous.id)} prefetch={false}><span>← Earlier</span>{previous.title.en}</Link>}
            {next && <Link className="document-nav-link next" href={noteHref(next.id)} prefetch={false}><span>Later →</span>{next.title.en}</Link>}
          </nav>

          {related.length > 0 && (
            <section className="related">
              <h2>More {note.category} decisions</h2>
              <ul>{related.map(entry => <li key={entry.id}><Link href={noteHref(entry.id)} prefetch={false}>{entry.title.en}</Link> <span className="related-date">{entry.date}</span></li>)}</ul>
            </section>
          )}
        </article>
      </PageFrame>
    </>
  )
}
