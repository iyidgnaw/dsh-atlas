import type { Metadata } from 'next'
import { getCatalog } from '@/lib/catalog'
import { isPublicSite, notesIndexDescription as description, siteName } from '@/lib/site'
import { NotesIndex } from './note-index'

export const metadata: Metadata = {
  title: 'All Agent Notes',
  description,
  keywords: ['DeepSeek Harness', 'Agent Notes', 'architecture decision records', 'changelog', 'design decisions'],
  alternates: isPublicSite ? { canonical: '/notes' } : undefined,
  openGraph: { type: 'website', title: `All Agent Notes | ${siteName}`, description, siteName, url: isPublicSite ? '/notes' : undefined },
  twitter: { card: 'summary_large_image', title: `All Agent Notes | ${siteName}`, description },
}

export default async function NotesIndexPage() {
  return <NotesIndex catalog={await getCatalog()} page={1} />
}
