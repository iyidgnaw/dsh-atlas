import type { MetadataRoute } from 'next'
import { isPublicSite, siteUrl } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: isPublicSite ? `${siteUrl.replace(/\/$/, '')}/sitemap.xml` : undefined,
  }
}
