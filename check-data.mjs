import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))

/**
 * `public/data` is generated, so a rebase that touches it is resolved by regenerating, never by
 * hand. A marker left behind means the resolution went wrong, and the catalog reader would fail
 * later with a bare `SyntaxError` that says nothing about the real cause.
 */
export function conflictMarkerIssue(relativePath, text) {
  if (!/^(?:<{7}|>{7})/m.test(text)) return null
  return `${relativePath} still has merge conflict markers — regenerate rather than hand-merge: run \`pnpm data:build && pnpm data:check\`, then \`git add public/data\``
}

async function walk(directory) {
  const output = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) output.push(...await walk(absolute))
    else output.push(absolute)
  }
  return output.sort()
}

async function main() {
  const dataRoot = path.join(root, 'public', 'data')
  const issues = []
  let files = []
  try {
    files = (await walk(dataRoot)).filter(file => file.endsWith('.json'))
  } catch (cause) {
    if (cause.code !== 'ENOENT') throw cause
    issues.push('public/data is missing — run `pnpm data:build`')
  }
  for (const file of files) {
    const relative = path.relative(root, file).split(path.sep).join('/')
    const issue = conflictMarkerIssue(relative, await readFile(file, 'utf8'))
    if (issue) issues.push(issue)
  }

  console.log('DATA GUARD')
  console.log(`  files checked: ${files.length}`)
  for (const issue of issues) console.log(`    ! ${issue}`)
  console.log(issues.length ? `DATA GUARD FAILED (${issues.length} issues)` : 'DATA GUARD OK')
  if (issues.length) process.exitCode = 1
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await main()
