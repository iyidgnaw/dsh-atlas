import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { getCatalog } from '@/lib/catalog'
import { notePageCount, notesPerPage } from '@/lib/note-pages.mjs'
import { isPublicSite, siteName } from '@/lib/site'
import { NotesIndex } from '../../note-index'

export const dynamicParams = false

interface NotesPageProps {
  params: Promise<{ page: string }>
}

export async function generateStaticParams() {
  const catalog = await getCatalog()
  return Array.from({ length: Math.max(0, notePageCount(catalog.notes, notesPerPage) - 1) }, (_, index) => ({ page: String(index + 2) }))
}

export async function generateMetadata({ params }: NotesPageProps): Promise<Metadata> {
  const { page } = await params
  const number = Number(page)
  if (!Number.isInteger(number) || number < 2) return {}
  const description = `Page ${number} of DeepSeek Harness Agent Notes: architecture, features, bug fixes, process, simplification, and testing decisions.`
  const pathname = `/notes/page/${number}`
  return { title: `All Agent Notes — Page ${number}`, description, alternates: isPublicSite ? { canonical: pathname } : undefined, openGraph: { type: 'website', title: `All Agent Notes — Page ${number} | ${siteName}`, description, siteName, url: isPublicSite ? pathname : undefined } }
}

export default async function NotesPage({ params }: NotesPageProps) {
  const { page } = await params
  const number = Number(page)
  const catalog = await getCatalog()
  if (!Number.isInteger(number) || number < 2 || number > notePageCount(catalog.notes, notesPerPage)) notFound()
  return <NotesIndex catalog={catalog} page={number} />
}
