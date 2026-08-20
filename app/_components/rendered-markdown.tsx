import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { noteHref } from '@/lib/catalog'
import type { Language } from '@/lib/types'

interface RenderedMarkdownProps {
  children: string
  /** Upstream path of the document being rendered, so relative links resolve the way Git sees them. */
  sourcePath: string
  sourceRepository: string
  sourceRevision: string
  notePathIndex?: Record<string, { id: string; language: Language }>
}

function resolveRelativePath(href: string, sourcePath: string) {
  const resolved = new URL(href, `https://source.invalid/${sourcePath}`)
  return { path: decodeURIComponent(resolved.pathname.slice(1)), hash: resolved.hash }
}

/**
 * Server-rendered Markdown. Unlike the explorer's client renderer this emits real `<a href>`
 * elements for cross-Note references, so the decision corpus is a crawlable link graph.
 */
export function RenderedMarkdown({ children, sourcePath, sourceRepository, sourceRevision, notePathIndex = {} }: RenderedMarkdownProps) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href = '', children: label }) => {
            if (/^(?:https?:|mailto:)/.test(href)) return <a href={href} target="_blank" rel="noreferrer">{label}</a>
            if (href.startsWith('#')) return <a href={href}>{label}</a>
            const resolved = resolveRelativePath(href, sourcePath)
            const target = notePathIndex[resolved.path]
            if (target) return <a href={noteHref(target.id)}>{label}</a>
            return <a href={`${sourceRepository}/blob/${sourceRevision}/${resolved.path}${resolved.hash}`} target="_blank" rel="noreferrer">{label}</a>
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
