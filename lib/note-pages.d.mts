export const notesPerPage: number
export function notePageCount<T>(notes: T[], pageSize: number): number
export function notesForPage<T>(notes: T[], page: number, pageSize: number): T[]
export function notePageHref(page: number): string
export function notesIndexStructuredData(input: {
  page: number
  pageNoteCount: number
  siteName: string
  description: string
  url: (pathname: string) => string
}): Record<string, unknown>
