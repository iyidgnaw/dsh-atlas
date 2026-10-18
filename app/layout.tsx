import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import './globals.css'
import { OceanCurrent } from './_components/ocean-current'
import { getCatalog } from '@/lib/catalog'
import { authorName, authorUrl, isPublicSite, siteAlternateName, siteName, siteUrl } from '@/lib/site'

// Carries both names: "DeepSeek Harness" for the subject, "(DSH Atlas)" because that shorthand is
// what people actually type, and it appeared nowhere on the site before.
const title = 'DeepSeek Harness Atlas (DSH Atlas) | Skills & Evolution'

// Counts are read from the catalog rather than written into the string: the previous hardcoded
// figure was still advertising 723 Notes after the corpus had passed 1200.
export async function generateMetadata(): Promise<Metadata> {
  const catalog = await getCatalog()
  const description = `${siteAlternateName} maps DeepSeek Harness through its ${catalog.skills.length} repository Skills and ${catalog.notes.length} bilingual Agent Notes: a searchable timeline of architecture, features, and decisions.`

  return {
    title: { default: title, template: `%s | ${siteName}` },
    description,
    metadataBase: new URL(siteUrl),
    applicationName: siteName,
    category: 'technology',
    keywords: [
      'DeepSeek Harness',
      'DeepSeek Harness architecture',
      'Agent Notes',
      'agent skills',
      'architecture decision records',
      'AI coding agent',
      'open source agent harness',
    ],
    authors: [{ name: authorName, url: authorUrl }],
    creator: authorName,
    publisher: authorName,
    alternates: isPublicSite ? { canonical: '/' } : undefined,
    openGraph: {
      type: 'website',
      title,
      description,
      siteName,
      locale: 'en_US',
      alternateLocale: 'zh_CN',
      url: isPublicSite ? siteUrl : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
    },
    formatDetection: { telephone: false, address: false, email: false },
    verification: { google: 'j0mtEya5BjPCAh5srrSc9CjQkJx-L1taZm-10WUcf1A' },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f7f8f5',
  colorScheme: 'light',
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <OceanCurrent />
        {children}
      </body>
    </html>
  )
}
