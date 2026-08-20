import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { cache } from 'react'

import type { Catalog } from './types'

export const getCatalog = cache(async (): Promise<Catalog> => {
  const source = await readFile(path.join(process.cwd(), 'public', 'data', 'catalog.json'), 'utf8')
  return JSON.parse(source) as Catalog
})
