const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (productionHost ? `https://${productionHost}` : 'http://localhost:3000')
export const isPublicSite = !siteUrl.startsWith('http://localhost')
