export const notesPerPage = 80

export function notePageCount(notes, pageSize) {
  return Math.ceil(notes.length / pageSize)
}

export function notesForPage(notes, page, pageSize) {
  const newestFirst = [...notes].reverse()
  const start = (page - 1) * pageSize
  return newestFirst.slice(start, start + pageSize)
}

export function notePageHref(page) {
  return page === 1 ? '/notes' : `/notes/page/${page}`
}

/**
 * Builds the structured data for one page of the Notes index. `url` is injected so this stays a
 * plain module the Node test runner can import without reaching into the TypeScript site config.
 */
export function notesIndexStructuredData({ page, pageNoteCount, siteName, description, url }) {
  const pathname = notePageHref(page)
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: page === 1 ? `All Agent Notes | ${siteName}` : `All Agent Notes — Page ${page} | ${siteName}`,
        description,
        url: url(pathname),
        inLanguage: ['en', 'zh-CN'],
        isPartOf: { '@type': 'WebSite', name: siteName, url: url('/') },
        mainEntity: { '@type': 'ItemList', name: 'DeepSeek Harness Agent Notes', numberOfItems: pageNoteCount },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: siteName, item: url('/') },
          { '@type': 'ListItem', position: 2, name: 'Agent Notes', item: url('/notes') },
          ...(page > 1 ? [{ '@type': 'ListItem', position: 3, name: `Page ${page}`, item: url(pathname) }] : []),
        ],
      },
    ],
  }
}
