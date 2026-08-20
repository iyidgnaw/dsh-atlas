const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (productionHost ? `https://${productionHost}` : 'http://localhost:3000')
export const isPublicSite = !siteUrl.startsWith('http://localhost')

export const siteName = 'DeepSeek Harness Atlas'
export const siteRepository = 'https://github.com/iyidgnaw/dsh-atlas'

/** Absolute URL for structured data, which cannot use the relative forms `metadataBase` resolves. */
export function absoluteUrl(pathname: string) {
  return new URL(pathname, siteUrl).toString()
}

/** Trims prose to a single meta-description-sized line without cutting a word in half. */
export function metaDescription(text: string, limit = 155) {
  const flat = text.replace(/[`*_>#]/g, '').replace(/\s+/g, ' ').trim()
  if (flat.length <= limit) return flat
  const clipped = flat.slice(0, limit)
  const lastSpace = clipped.lastIndexOf(' ')
  return `${(lastSpace > limit * 0.6 ? clipped.slice(0, lastSpace) : clipped).replace(/[,;:.\s]+$/, '')}…`
}
