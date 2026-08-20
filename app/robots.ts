import type { MetadataRoute } from 'next'

import { absoluteUrl, isPublicSite, siteUrl } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  // `/data/` stays crawlable: the explorer fetches Note bodies from there while rendering.
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: isPublicSite ? absoluteUrl('/sitemap.xml') : undefined,
    host: isPublicSite ? siteUrl : undefined,
  }
}
