'use client'

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type { Language, NoteBodyRecord } from '@/lib/types'

interface NoteTarget {
  id: string
  language: Language
}

interface NoteBodyProps {
  bodyPath: string
  language: Language
  sourcePath: string
  sourceRepository: string
  sourceRevision: string
  notePathIndex: Record<string, NoteTarget>
  onNavigate: (target: NoteTarget) => void
}

function resolveRelativePath(href: string, sourcePath: string) {
  const resolved = new URL(href, `https://source.invalid/${sourcePath}`)
  return { path: decodeURIComponent(resolved.pathname.slice(1)), hash: resolved.hash }
}

export function NoteBody({ bodyPath, language, sourcePath, sourceRepository, sourceRevision, notePathIndex, onNavigate }: NoteBodyProps) {
  const [record, setRecord] = useState<NoteBodyRecord | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    fetch(bodyPath, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`Could not load this Note (${response.status})`)
        return response.json() as Promise<NoteBodyRecord>
      })
      .then(setRecord)
      .catch(cause => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(cause instanceof Error ? cause.message : 'Could not load this Note')
      })
    return () => controller.abort()
  }, [bodyPath])

  if (error) return <p className="note-load-state error">{error}</p>
  if (!record) return <p className="note-load-state">Loading Note…</p>

  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href = '', children }) => {
            if (/^(?:https?:|mailto:)/.test(href)) return <a href={href} target="_blank" rel="noreferrer">{children}</a>
            if (href.startsWith('#')) return <a href={href}>{children}</a>
            const resolved = resolveRelativePath(href, sourcePath)
            const target = notePathIndex[resolved.path]
            if (target) {
              return <button className="inline-note-link" type="button" onClick={() => onNavigate({ ...target, language })}>{children}</button>
            }
            return <a href={`${sourceRepository}/blob/${sourceRevision}/${resolved.path}${resolved.hash}`} target="_blank" rel="noreferrer">{children}</a>
          },
        }}
      >
        {record.content[language]}
      </ReactMarkdown>
    </div>
  )
}
