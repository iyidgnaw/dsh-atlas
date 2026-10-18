import { getCatalog } from '@/lib/catalog'
import { llmsText } from '@/lib/llms.mjs'
import { siteUrl } from '@/lib/site'

export const dynamic = 'force-static'

export async function GET() {
  const catalog = await getCatalog()
  return new Response(llmsText({ catalog, siteUrl }), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
