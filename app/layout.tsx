import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import './globals.css'
import { OceanCurrent } from './_components/ocean-current'
import { isPublicSite, siteName, siteUrl } from '@/lib/site'

const title = 'DeepSeek Harness Atlas | Skills & Evolution'
const description = 'Learn DeepSeek Harness through its repository skills and 723 bilingual Agent Notes, mapped as a searchable timeline of architecture, features, and decisions.'

export const metadata: Metadata = {
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
  authors: [{ name: 'iyidgnaw', url: 'https://github.com/iyidgnaw' }],
  creator: 'iyidgnaw',
  publisher: 'iyidgnaw',
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
