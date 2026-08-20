import type { MetadataRoute } from 'next'
import { isPublicSite, siteUrl } from '@/lib/site'

export default function sitemap(): MetadataRoute.Sitemap {
  return isPublicSite ? [{ url: siteUrl, changeFrequency: 'weekly', priority: 1 }] : []
}
