import type { MetadataRoute } from 'next'

import { getCatalog, noteHref, skillHref } from '@/lib/catalog'
import { absoluteUrl, isPublicSite } from '@/lib/site'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isPublicSite) return []
  const catalog = await getCatalog()
  const newest = catalog.notes.at(-1)?.date

  return [
    { url: absoluteUrl('/'), lastModified: newest, changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/notes'), lastModified: newest, changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/skills'), lastModified: newest, changeFrequency: 'weekly', priority: 0.9 },
    ...catalog.skills.map(skill => ({
      url: absoluteUrl(skillHref(skill.name)),
      lastModified: newest,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...catalog.notes.map(note => ({
      url: absoluteUrl(noteHref(note.id)),
      lastModified: note.archivedDate || note.date,
      changeFrequency: 'monthly' as const,
      priority: note.status === 'proposed' ? 0.7 : 0.6,
    })),
  ]
}
