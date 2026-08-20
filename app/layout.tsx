import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import './globals.css'
import { isPublicSite, siteUrl } from '@/lib/site'

const title = 'DeepSeek Harness Atlas | Skills & Evolution'
const description = 'Learn DeepSeek Harness through its repository skills and 723 bilingual Agent Notes, mapped as a searchable timeline of architecture, features, and decisions.'
export const metadata: Metadata = {
  title,
  description,
  metadataBase: new URL(siteUrl),
  alternates: isPublicSite ? { canonical: '/' } : undefined,
  openGraph: {
    type: 'website',
    title,
    description,
    siteName: 'DeepSeek Harness Atlas',
    url: isPublicSite ? siteUrl : undefined,
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
  robots: { index: true, follow: true },
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
      <body>{children}</body>
    </html>
  )
}
