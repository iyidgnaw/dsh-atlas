interface LlmsCatalog {
  sourceRepository: string
  sourceBranch: string
  sourceRevision: string
  skills: Array<{ name: string; title: string; description: string }>
  notes: Array<{ date: string }>
}

export function llmsText(input: {
  catalog: LlmsCatalog
  siteUrl: string
  siteName?: string
  siteAlternateName?: string
}): string
