import Link from 'next/link'
import type { ReactNode } from 'react'

import { siteRepository } from '@/lib/site'

interface PageFrameProps {
  active: 'notes' | 'skills'
  sourceRepository: string
  sourceBranch: string
  sourceRevision: string
  noteCount: number
  children: ReactNode
}

/** Static chrome for the crawlable Note and Skill routes, mirroring the explorer's topbar and footer. */
export function PageFrame({ active, sourceRepository, sourceBranch, sourceRevision, noteCount, children }: PageFrameProps) {
  return (
    <>
      <header className="shell topbar">
        <Link className="brand" href="/"><b>DSH</b> / Atlas</Link>
        <nav className="tabs" aria-label="Atlas sections">
          <Link className={`tab ${active === 'notes' ? 'active' : ''}`} href="/notes">Notes</Link>
          <Link className={`tab ${active === 'skills' ? 'active' : ''}`} href="/skills">Skills</Link>
        </nav>
        <div className="repo-links">
          <a className="repo-link" href={siteRepository} target="_blank" rel="noreferrer">dsh-atlas repo</a>
          <a className="repo-link" href={`${sourceRepository}/tree/${sourceRevision}`} target="_blank" rel="noreferrer">Tracking {sourceBranch} @ {sourceRevision.slice(0, 10)}</a>
        </div>
      </header>
      <main>{children}</main>
      <footer className="footer"><div className="shell">
        <Link href="/">Interactive timeline</Link> · <Link href="/notes">All Notes</Link> · <Link href="/skills">All Skills</Link> · Source: <a href={sourceRepository} target="_blank" rel="noreferrer">{sourceRepository}</a> · {noteCount} bilingual Agent Notes
      </div></footer>
    </>
  )
}

export function Breadcrumbs({ trail }: { trail: Array<{ name: string; href?: string }> }) {
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {trail.map((crumb, index) => (
        <span key={crumb.name}>
          {index > 0 && <span className="breadcrumb-sep" aria-hidden="true">/</span>}
          {crumb.href ? <Link href={crumb.href}>{crumb.name}</Link> : <span aria-current="page">{crumb.name}</span>}
        </span>
      ))}
    </nav>
  )
}

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replaceAll('<', '\\u003c') }} />
}
