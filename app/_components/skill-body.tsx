'use client'

import { useEffect, useState } from 'react'

import type { SkillBodyRecord } from '@/lib/types'
import { MarkdownContent } from './markdown-content'

interface SkillBodyProps {
  bodyPath: string
}

export function SkillBody({ bodyPath }: SkillBodyProps) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    fetch(bodyPath, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`Could not load this Skill (${response.status})`)
        return response.json() as Promise<SkillBodyRecord>
      })
      .then(record => setContent(record.content))
      .catch(cause => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(cause instanceof Error ? cause.message : 'Could not load this Skill')
      })
    return () => controller.abort()
  }, [bodyPath])

  if (error) return <p className="note-load-state error">{error}</p>
  if (content === null) return <p className="note-load-state">Loading Skill…</p>
  return <MarkdownContent>{content}</MarkdownContent>
}
