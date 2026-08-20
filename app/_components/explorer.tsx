'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { ExplorerCatalog, Language } from '@/lib/types'

const MarkdownContent = dynamic(() => import('./markdown-content').then(module => module.MarkdownContent))
const NoteBody = dynamic(() => import('./note-body').then(module => module.NoteBody), {
  loading: () => <p className="note-load-state">Loading Note renderer…</p>,
})

const NOTE_CLASSES = ['architecture', 'bug-fix', 'feature', 'process', 'simplification', 'testing'] as const
const INITIAL_BATCH = 80

interface ExplorerProps {
  catalog: ExplorerCatalog
}

interface NoteTarget {
  id: string
  language: Language
}

function toggleSet<T>(source: Set<T>, value: T) {
  const next = new Set(source)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

export function Explorer({ catalog }: ExplorerProps) {
  const [activeTab, setActiveTab] = useState<'skills' | 'notes'>('notes')
  const [skillSearch, setSkillSearch] = useState('')
  const [skillGroup, setSkillGroup] = useState('all')
  const [openSkills, setOpenSkills] = useState<Set<string>>(() => new Set())
  const [noteSearch, setNoteSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [lifecycle, setLifecycle] = useState('all')
  const [categories, setCategories] = useState<Set<string>>(() => new Set(NOTE_CLASSES))
  const [globalLanguage, setGlobalLanguage] = useState<Language>('en')
  const [languageOverrides, setLanguageOverrides] = useState<Record<string, Language>>({})
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH)
  const [pendingTarget, setPendingTarget] = useState<string | null>(null)
  const [highlightedNoteId, setHighlightedNoteId] = useState<string | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const skillGroups = useMemo(() => [...new Set(catalog.skills.map(skill => skill.group))], [catalog.skills])
  const visibleSkills = useMemo(() => {
    const query = skillSearch.trim().toLowerCase()
    return catalog.skills.filter(skill => (
      (!query || `${skill.name} ${skill.title} ${skill.description}`.toLowerCase().includes(query)) &&
      (skillGroup === 'all' || skill.group === skillGroup)
    ))
  }, [catalog.skills, skillGroup, skillSearch])

  const visibleNotes = useMemo(() => {
    const query = noteSearch.trim().toLowerCase()
    return catalog.notes.filter(note => (
      (!query || `${note.title.en} ${note.title.zh} ${note.summary.en} ${note.summary.zh}`.toLowerCase().includes(query)) &&
      (status === 'all' || note.status === status) &&
      (lifecycle === 'all' || note.lifecycle === lifecycle) &&
      categories.has(note.category)
    ))
  }, [catalog.notes, categories, lifecycle, noteSearch, status])

  const notePathIndex = useMemo(() => Object.fromEntries(catalog.notes.flatMap(note => [
    [note.sourcePath, { id: note.id, language: 'en' as const }],
    [note.sourcePath.replace(/\.md$/, '.zh.md'), { id: note.id, language: 'zh' as const }],
  ])), [catalog.notes])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || visibleCount >= visibleNotes.length) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0]?.isIntersecting) setVisibleCount(count => Math.min(count + INITIAL_BATCH, visibleNotes.length))
    }, { rootMargin: '700px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [visibleCount, visibleNotes.length])

  useEffect(() => {
    if (!pendingTarget) return
    const index = visibleNotes.findIndex(note => note.id === pendingTarget)
    if (index < 0) return
    if (index >= visibleCount) return
    let settleFrame = 0
    const startedAt = performance.now()
    const frame = requestAnimationFrame(() => {
      const target = [...document.querySelectorAll<HTMLElement>('[data-note-id]')].find(element => element.dataset.noteId === pendingTarget)
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        const settle = () => {
          const bounds = target.getBoundingClientRect()
          const centerDistance = Math.abs((bounds.top + bounds.bottom) / 2 - window.innerHeight / 2)
          if (centerDistance < 140 || performance.now() - startedAt > 1400) {
            target.scrollIntoView({ block: 'center' })
            setHighlightedNoteId(pendingTarget)
            setPendingTarget(null)
            return
          }
          settleFrame = requestAnimationFrame(settle)
        }
        settleFrame = requestAnimationFrame(settle)
      }
    })
    return () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(settleFrame)
    }
  }, [pendingTarget, visibleCount, visibleNotes])

  useEffect(() => {
    if (!highlightedNoteId) return
    const timeout = window.setTimeout(() => setHighlightedNoteId(null), 3200)
    return () => window.clearTimeout(timeout)
  }, [highlightedNoteId])

  useEffect(() => {
    if (!focusedNoteId || pendingTarget || highlightedNoteId === focusedNoteId) return
    let observer: IntersectionObserver | undefined
    const frame = requestAnimationFrame(() => {
      const target = [...document.querySelectorAll<HTMLElement>('[data-note-id]')].find(element => element.dataset.noteId === focusedNoteId)
      if (!target) return
      let hasIntersected = false
      observer = new IntersectionObserver(entries => {
        if (entries[0]?.isIntersecting) {
          hasIntersected = true
          return
        }
        if (hasIntersected) setFocusedNoteId(current => current === focusedNoteId ? null : current)
      })
      observer.observe(target)
    })
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [focusedNoteId, highlightedNoteId, pendingTarget, visibleCount])

  function languageFor(noteId: string) {
    return languageOverrides[noteId] || globalLanguage
  }

  function navigateToNote(target: NoteTarget) {
    const note = catalog.notes.find(candidate => candidate.id === target.id)
    if (!note) return
    setActiveTab('notes')
    setNoteSearch('')
    setStatus('all')
    setLifecycle('all')
    setCategories(current => new Set(current).add(note.category))
    setFocusedNoteId(null)
    setLanguageOverrides(current => ({ ...current, [note.id]: target.language }))
    setVisibleCount(Math.max(INITIAL_BATCH, catalog.notes.findIndex(candidate => candidate.id === note.id) + 1))
    setPendingTarget(note.id)
  }

  function setAllLanguages(language: Language) {
    setGlobalLanguage(language)
    setLanguageOverrides({})
  }

  return (
    <>
      <div className="progress" aria-hidden="true" />
      <header className="shell topbar">
        <div className="brand"><b>DSH</b> / Atlas</div>
        <nav className="tabs" aria-label="Explorer views">
          <button className={`tab ${activeTab === 'notes' ? 'active' : ''}`} type="button" onClick={() => setActiveTab('notes')}>Notes</button>
          <button className={`tab ${activeTab === 'skills' ? 'active' : ''}`} type="button" onClick={() => setActiveTab('skills')}>Skills</button>
        </nav>
        <div className="repo-links"><a className="repo-link" href="https://github.com/iyidgnaw/dsh-atlas" target="_blank" rel="noreferrer">dsh-atlas repo</a><a className="repo-link" href={`${catalog.sourceRepository}/tree/${catalog.sourceRevision}`} target="_blank" rel="noreferrer">Tracking {catalog.sourceBranch} @ {catalog.sourceRevision.slice(0, 10)}</a></div>
      </header>

      <main>
        <header className="shell site-hero">
          <div className="eyebrow">A visual field guide</div>
          <h1>DeepSeek Harness Atlas</h1>
          <p className="tagline">Skills, architecture, and decisions—mapped.</p>
          <p className="learn">A development timeline and roadmap for DeepSeek Harness.</p>
        </header>

        {activeTab === 'skills' ? (
          <section>
            <div className="shell section-intro">
              <h2>Repository Skills</h2>
              <p>Repeatable workflows for reviewing, documenting, simplifying, translating, validating, and shipping DeepSeek Harness.</p>
              <div className="metrics"><span className="metric"><b>{catalog.skills.length}</b> Skills</span></div>
            </div>
            <div className="toolbar"><div className="shell controls">
              <input className="control search" type="search" value={skillSearch} onChange={event => setSkillSearch(event.target.value)} placeholder="Search skills and workflows…" aria-label="Search skills" />
              <select className="control" value={skillGroup} onChange={event => setSkillGroup(event.target.value)} aria-label="Skill group">
                <option value="all">All groups</option>
                {skillGroups.map(group => <option key={group} value={group}>{group}</option>)}
              </select>
              <span className="count">{visibleSkills.length} / {catalog.skills.length}</span>
            </div></div>
            <div className="shell skills-grid">
              {visibleSkills.map(skill => {
                const open = openSkills.has(skill.id)
                return <article className={`skill-card ${open ? 'open' : ''}`} key={skill.id}>
                  <div className="skill-main">
                    <div className="skill-id">{skill.name}</div>
                    <h3>{skill.title}</h3>
                    <p className="description">{skill.description}</p>
                    <div className="flow">{skill.workflow.map((step, index) => <div className="flow-step" data-step={index + 1} key={step}>{step}</div>)}</div>
                  </div>
                  <button className="disclose" type="button" aria-expanded={open} onClick={() => setOpenSkills(current => toggleSet(current, skill.id))}>Read the full workflow</button>
                  {open && <div className="skill-source"><div className="source-path"><a href={`${catalog.sourceRepository}/blob/${catalog.sourceRevision}/${skill.sourcePath}`} target="_blank" rel="noreferrer">{skill.sourcePath}</a></div><div className="markdown"><MarkdownContent>{skill.content}</MarkdownContent></div></div>}
                </article>
              })}
            </div>
          </section>
        ) : (
          <section>
            <div className="shell section-intro">
              <h2>Evolution Timeline</h2>
              <p>One chronological trunk, one node per decision. Cards branch left and right; each Note can switch between English and Chinese.</p>
              <div className="metrics">
                <span className="metric"><b>{catalog.notes.length}</b> bilingual pairs</span>
                <span className="metric"><b>{catalog.notes.filter(note => note.status === 'implemented').length}</b> implemented</span>
                <span className="metric"><b>{catalog.notes.filter(note => note.status === 'rejected').length}</b> rejected</span>
                <span className="metric"><b>{catalog.notes.filter(note => note.status === 'proposed').length}</b> proposed</span>
              </div>
              <p className="archive-note">Archived nodes stay green because their decisions shipped. They are frozen historical records, not current authority.</p>
            </div>
            <div className="toolbar"><div className="shell">
              <div className="controls">
                <input className="control search" type="search" value={noteSearch} onChange={event => { setNoteSearch(event.target.value); setVisibleCount(INITIAL_BATCH); setFocusedNoteId(null) }} placeholder="Search English or Chinese titles and problems…" aria-label="Search Notes" />
                <select className="control" value={status} onChange={event => { setStatus(event.target.value); setVisibleCount(INITIAL_BATCH); setFocusedNoteId(null) }} aria-label="Note status">
                  <option value="all">All statuses</option><option value="implemented">Implemented</option><option value="rejected">Rejected</option><option value="proposed">Proposed</option>
                </select>
                <select className="control" value={lifecycle} onChange={event => { setLifecycle(event.target.value); setVisibleCount(INITIAL_BATCH); setFocusedNoteId(null) }} aria-label="Note lifecycle">
                  <option value="all">All lifecycles</option><option value="implemented">Active implemented</option><option value="archived">Archived</option><option value="proposed">Proposed</option><option value="rejected">Rejected</option>
                </select>
                <div className="segmented" aria-label="Global Note language"><button className={globalLanguage === 'en' ? 'active' : ''} type="button" onClick={() => setAllLanguages('en')}>English</button><button className={globalLanguage === 'zh' ? 'active' : ''} type="button" onClick={() => setAllLanguages('zh')}>中文</button></div>
                <span className="count">{visibleNotes.length} / {catalog.notes.length}</span>
              </div>
              <div className="tag-filters" aria-label="Note type filters">
                {NOTE_CLASSES.map(category => <label className="tag-filter" key={category}><input type="checkbox" checked={categories.has(category)} onChange={() => { setCategories(current => toggleSet(current, category)); setVisibleCount(INITIAL_BATCH); setFocusedNoteId(null) }} /><span>{category}</span></label>)}
              </div>
            </div></div>
            <div className="timeline-region" onClick={event => { if (focusedNoteId && !(event.target as Element).closest('.note-card')) setFocusedNoteId(null) }}>
              <div className="shell">
                <div className="legend"><span><i className="implemented" />Implemented / Archived</span><span><i className="rejected" />Rejected</span><span><i className="proposed" />Proposed</span></div>
                <div className={`timeline ${focusedNoteId ? `focused focus-${visibleNotes.findIndex(note => note.id === focusedNoteId) % 2 ? 'right' : 'left'}` : ''}`}>
                  {visibleNotes.slice(0, visibleCount).map((note, index) => <TimelineNote key={note.id} note={note} index={index} previousDate={visibleNotes[index - 1]?.date} language={languageFor(note.id)} open={focusedNoteId === note.id} highlighted={highlightedNoteId === note.id} sourceRepository={catalog.sourceRepository} sourceRevision={catalog.sourceRevision} notePathIndex={notePathIndex} onNavigate={navigateToNote} onToggle={() => setFocusedNoteId(current => current === note.id ? null : note.id)} onLanguage={() => setLanguageOverrides(current => ({ ...current, [note.id]: languageFor(note.id) === 'en' ? 'zh' : 'en' }))} />)}
                  {visibleCount < visibleNotes.length && <div className="sentinel" ref={sentinelRef}>Loading more decisions…</div>}
                </div>
                {!visibleNotes.length && <div className="empty">No Agent Notes match these filters.</div>}
              </div>
            </div>
          </section>
        )}
      </main>
      <button className="top-button" type="button" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>↑</button>
      <footer className="footer"><div className="shell">Source: <a href={catalog.sourceRepository} target="_blank" rel="noreferrer">{catalog.sourceRepository}</a> · {catalog.notes.length} bilingual Agent Notes</div></footer>
    </>
  )
}

interface TimelineNoteProps {
  note: ExplorerCatalog['notes'][number]
  index: number
  previousDate?: string
  language: Language
  open: boolean
  highlighted: boolean
  sourceRepository: string
  sourceRevision: string
  notePathIndex: Record<string, NoteTarget>
  onNavigate: (target: NoteTarget) => void
  onToggle: () => void
  onLanguage: () => void
}

function TimelineNote({ note, index, previousDate, language, open, highlighted, sourceRepository, sourceRevision, notePathIndex, onNavigate, onToggle, onLanguage }: TimelineNoteProps) {
  return <>
    {note.date !== previousDate && <div className="date-row"><span>{note.date}</span></div>}
    <article className={`timeline-item ${index % 2 ? 'right' : 'left'} ${open ? 'focused' : ''} ${highlighted ? 'destination-highlight' : ''}`} data-status={note.status} data-category={note.category} data-note-id={note.id}>
      <span className="pin" aria-hidden="true" />
      <div className={`note-card ${open ? 'open' : ''}`}>
        <div className="note-head">
          <button className="note-open" type="button" aria-expanded={open} onClick={onToggle}>
            <span className="note-meta"><span>{note.date}</span><span className="badge status">{note.status}</span><span className="badge category">{note.category}</span>{note.archived && <span className="badge">archived</span>}{note.sourceWarnings.length > 0 && <span className="badge warning">source format</span>}</span>
            <h3 className="note-title">{note.title[language]}</h3>
            <p className="note-summary">{note.summary[language] || note.statusLine[language]}</p>
          </button>
          <div className="card-actions"><button className="mini-button" type="button" onClick={onLanguage}>{language === 'en' ? '中文' : 'EN'}</button><button className="expand-button" type="button" aria-label={open ? 'Collapse Note' : 'Expand Note'} onClick={onToggle}>＋</button></div>
        </div>
        {open && <div className="note-detail">
          <div className="source-path"><a href={`${sourceRepository}/blob/${sourceRevision}/${note.sourcePath}`} target="_blank" rel="noreferrer">{note.sourcePath}</a></div>
          {note.sourceWarnings.length > 0 && <p className="source-warning">Source compatibility: {note.sourceWarnings.join('; ')}</p>}
          <NoteBody bodyPath={note.bodyPath} language={language} sourcePath={note.sourcePath} sourceRepository={sourceRepository} sourceRevision={sourceRevision} notePathIndex={notePathIndex} onNavigate={onNavigate} />
        </div>}
      </div>
    </article>
  </>
}
