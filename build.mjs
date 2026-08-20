import { createHash } from 'node:crypto'
import { execFile as execFileCallback } from 'node:child_process'
import { lstat, mkdir, readFile, readdir, readlink, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

export const SOURCE_REPOSITORY = 'https://github.com/deepseek-ai/deepseek-harness'
export const LIFECYCLES = ['implemented', 'proposed', 'rejected', 'archived']
export const NOTE_CLASSES = ['feature', 'bug-fix', 'simplification', 'architecture', 'process', 'testing']
const NOTE_PATTERN = new RegExp(`^(${LIFECYCLES.join('|')})/(${NOTE_CLASSES.join('|')})/(20\\d{2}-\\d{2}-\\d{2}-.+?)(\\.zh)?\\.md$`)
const sha256 = value => createHash('sha256').update(value).digest('hex')
const execFile = promisify(execFileCallback)
const posix = value => value.split(path.sep).join('/')

async function walk(root) {
  const output = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name)
    if (entry.isDirectory()) output.push(...await walk(absolute))
    else output.push(absolute)
  }
  return output.sort()
}

function parseNote(source) {
  const canonicalTitle = source.match(/^# Agent Note:\s*(.+)$/m)
  const compatibleTitle = source.match(/^# Agent Note(?:（[^）]*）)?[:：]\s*(.+)$/m)
  const canonicalStatus = source.match(/^Status:\s*(.+)$/m)
  const compatibleStatus = source.match(/^(?:Status|状态)[:：]\s*(.+)$/m)
  const statusLine = (canonicalStatus || compatibleStatus)?.[1]?.trim()
  const statusValue = /^(?:implemented|已实现)/.test(statusLine || '')
    ? 'implemented'
    : /^(?:proposed|提案)/.test(statusLine || '')
      ? 'proposed'
      : /^(?:rejected|已拒绝)/.test(statusLine || '') ? 'rejected' : ''
  const bodyStart = source.search(/\n##\s+/)
  return {
    title: (canonicalTitle || compatibleTitle)?.[1]?.trim(),
    canonicalTitle: Boolean(canonicalTitle),
    statusLine,
    statusValue,
    canonicalStatus: Boolean(canonicalStatus),
    archivedDate: source.match(/^Archived:\s*(.+)$/m)?.[1]?.trim() || '',
    problem: source.match(/## (?:Problem|问题)\n+([\s\S]*?)(?=\n## |$)/)?.[1]?.replace(/\s+/g, ' ').trim() || '',
    body: bodyStart >= 0 ? source.slice(bodyStart + 1) : source,
  }
}

function excludedReason(relative, stat, target) {
  if (stat.isSymbolicLink()) return `symlink to ${target}; instruction alias, not an Agent Note`
  if (path.basename(relative) === 'AGENTS.md') return 'directory instructions, not a dated Agent Note'
  if (path.basename(relative) === 'README.md') return 'Agent Note format documentation, not a dated Agent Note'
  return 'Markdown file outside the canonical lifecycle/class/date path'
}

export async function scanNotes(notesRoot) {
  const excluded = []
  const invalid = []
  const warnings = []
  const grouped = new Map()
  for (const absolute of await walk(notesRoot)) {
    if (!absolute.endsWith('.md')) continue
    const relative = posix(path.relative(notesRoot, absolute))
    const stat = await lstat(absolute)
    const match = relative.match(NOTE_PATTERN)
    if (!match || stat.isSymbolicLink()) {
      const target = stat.isSymbolicLink() ? await readlink(absolute) : ''
      excluded.push({ path: relative, reason: excludedReason(relative, stat, target) })
      continue
    }
    const [, lifecycle, category, stem, chinese] = match
    const id = `${lifecycle}/${category}/${stem}`
    const pair = grouped.get(id) || { id, lifecycle, category, stem }
    pair[chinese ? 'zhPath' : 'enPath'] = absolute
    grouped.set(id, pair)
  }

  const records = []
  for (const pair of [...grouped.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!pair.enPath || !pair.zhPath) {
      invalid.push({ path: pair.id, reason: pair.enPath ? 'missing Chinese counterpart' : 'missing English counterpart' })
      continue
    }
    const [enSource, zhSource] = await Promise.all([readFile(pair.enPath, 'utf8'), readFile(pair.zhPath, 'utf8')])
    const en = parseNote(enSource)
    const zh = parseNote(zhSource)
    const expected = pair.lifecycle === 'archived' ? 'implemented' : pair.lifecycle
    const errors = []
    if (!en.title) errors.push('English title missing')
    if (!zh.title) errors.push('Chinese title missing')
    if (en.statusValue !== expected) errors.push(`English status does not match ${expected}`)
    if (zh.statusValue !== expected) errors.push(`Chinese status does not match ${expected}`)
    if (errors.length) {
      invalid.push({ path: pair.id, reason: errors.join('; ') })
      continue
    }
    const sourceWarnings = []
    if (!zh.canonicalTitle) sourceWarnings.push('Chinese title uses a compatible non-canonical header')
    if (!zh.canonicalStatus) sourceWarnings.push('Chinese status uses a compatible non-canonical header')
    if (sourceWarnings.length) warnings.push({ path: pair.id, reason: sourceWarnings.join('; ') })
    records.push({
      id: pair.id,
      date: pair.stem.slice(0, 10),
      lifecycle: pair.lifecycle,
      category: pair.category,
      status: expected,
      archived: pair.lifecycle === 'archived',
      archivedDate: en.archivedDate,
      sourcePath: `.agents/notes/${pair.lifecycle}/${pair.category}/${pair.stem}.md`,
      title: { en: en.title, zh: zh.title },
      statusLine: { en: en.statusLine, zh: zh.statusLine },
      summary: { en: en.problem.slice(0, 420), zh: zh.problem.slice(0, 420) },
      content: { en: en.body, zh: zh.body },
      hashes: { en: sha256(enSource), zh: sha256(zhSource) },
      sourceWarnings,
    })
  }
  records.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  return { records, excluded, invalid, warnings }
}

export function reconcileRecords(sourceRecords, generatedRecords) {
  const source = new Map(sourceRecords.map(record => [record.id, record]))
  const generated = new Map()
  const duplicate = []
  for (const record of generatedRecords) {
    if (generated.has(record.id)) {
      if (!duplicate.includes(record.id)) duplicate.push(record.id)
    } else generated.set(record.id, record)
  }
  return {
    missing: [...source.keys()].filter(id => !generated.has(id)).sort(),
    extra: [...generated.keys()].filter(id => !source.has(id)).sort(),
    duplicate: duplicate.sort(),
    hashMismatch: [...source.keys()].filter(id => {
      const actual = generated.get(id)
      return actual && (source.get(id).hashes.en !== actual.hashes?.en || source.get(id).hashes.zh !== actual.hashes?.zh)
    }).sort(),
  }
}

function parseFrontmatter(source) {
  if (!source.startsWith('---\n')) return { attributes: {}, body: source }
  const end = source.indexOf('\n---\n', 4)
  const attributes = {}
  for (const line of source.slice(4, end).split('\n')) {
    const match = line.match(/^([\w-]+):\s*(.*)$/)
    if (match) attributes[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
  return { attributes, body: source.slice(end + 5) }
}

const guides = {
  'dsh-archive-agent-notes': ['Knowledge', 'Agent Note lifecycle', ['Read contracts', 'Check supersession', 'Classify future value', 'Move complete triplets', 'Seal and verify']],
  'dsh-code-review': ['Review', 'Independent PR review', ['Verify base and head', 'Map change scope', 'Trace contracts', 'Check evidence', 'Report findings']],
  'dsh-doc-site-sync': ['Docs', 'Documentation site sync', ['Locate canonical source', 'Classify change', 'Update allowlist', 'Verify projected links', 'Run docs gates']],
  'dsh-doc-standards': ['Docs', 'Documentation structure', ['Locate responsibility', 'Set detail level', 'Choose tutorial or reference', 'Remove slop', 'Verify structure']],
  'dsh-find-simplifications': ['Architecture', 'Evidence-led simplification', ['Map consumers', 'Find dead surfaces', 'Prove deletion', 'Record trade-offs', 'Verify absence']],
  'dsh-merging-stacked-prs': ['Delivery', 'Stacked PR merging', ['Read live stack', 'Verify each head', 'Merge dependencies first', 'Recheck retargets', 'Confirm final state']],
  'dsh-pre-push-checks': ['Quality', 'Change-scoped pre-push checks', ['Verify base', 'Run change-scope', 'Map gate families', 'Run sufficient checks', 'Report evidence']],
  'dsh-prose-standard': ['Docs', 'Contract-first prose', ['Confirm scope', 'List propositions', 'Preserve conditions', 'Remove narration', 'Verify coverage']],
  'dsh-translate-docs': ['Docs', 'Bilingual documentation', ['Read pairing contract', 'Choose source language', 'Preserve structure', 'Update counterpart', 'Record and verify']],
  'dsh-trim-cot-leakage': ['Docs', 'Reasoning-leakage cleanup', ['Find unresolved references', 'Classify leakage', 'Preserve facts', 'Rewrite from HEAD', 'Rerun probes']],
  'record-browser-gif': ['Media', 'Browser GIF evidence', ['Fix commit and environment', 'Design key states', 'Capture by state', 'Encode deterministically', 'Publish when requested']],
}

async function scanSkills(skillsRoot) {
  const records = []
  for (const absolute of (await walk(skillsRoot)).filter(file => path.basename(file) === 'SKILL.md')) {
    const source = await readFile(absolute, 'utf8')
    const parsed = parseFrontmatter(source)
    const name = parsed.attributes.name || path.basename(path.dirname(absolute))
    const guide = guides[name] || ['Other', name, []]
    records.push({ id: name, name, group: guide[0], title: guide[1], workflow: guide[2], description: parsed.attributes.description || '', sourcePath: `.agents/skills/${path.basename(path.dirname(absolute))}/SKILL.md`, content: parsed.body, hash: sha256(source) })
  }
  return records.sort((a, b) => a.id.localeCompare(b.id))
}

function reportInventory(inventory) {
  console.log('SOURCE INVENTORY')
  console.log(`  valid bilingual Note pairs: ${inventory.records.length}`)
  for (const value of LIFECYCLES) console.log(`  ${value.padEnd(12)} ${inventory.records.filter(record => record.lifecycle === value).length}`)
  console.log(`  excluded Markdown candidates: ${inventory.excluded.length}`)
  for (const item of inventory.excluded) console.log(`    - ${item.path} — ${item.reason}`)
  console.log(`  invalid Note-shaped candidates: ${inventory.invalid.length}`)
  for (const item of inventory.invalid) console.log(`    ! ${item.path} — ${item.reason}`)
  console.log(`  included with compatible non-canonical headers: ${inventory.warnings.length}`)
  for (const item of inventory.warnings) console.log(`    ~ ${item.path} — ${item.reason}`)
}

function reportRecon(name, result) {
  console.log(`${name} RECONCILIATION`)
  for (const [key, values] of Object.entries(result)) {
    console.log(`  ${key}: ${values.length}`)
    for (const value of values) console.log(`    ! ${value}`)
  }
}

function publicRecord(note) {
  const metadata = { ...note }
  delete metadata.content
  return { ...metadata, bodyPath: `/data/notes/${note.id}.json` }
}

async function sourceRevision(sourceRepo) {
  const { stdout } = await execFile('git', ['-C', sourceRepo, 'rev-parse', 'HEAD'])
  return stdout.trim()
}

async function writeData(root, skills, notes, revision) {
  const dataRoot = path.join(root, 'public', 'data')
  await rm(dataRoot, { recursive: true, force: true })
  await mkdir(path.join(dataRoot, 'notes'), { recursive: true })
  const catalog = {
    sourceRepository: SOURCE_REPOSITORY,
    sourceBranch: 'master',
    sourceRevision: revision,
    skills,
    notes: notes.map(publicRecord),
  }
  await writeFile(path.join(dataRoot, 'catalog.json'), `${JSON.stringify(catalog)}\n`)
  for (const note of notes) {
    const target = path.join(dataRoot, 'notes', `${note.id}.json`)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, `${JSON.stringify({ id: note.id, hashes: note.hashes, content: note.content })}\n`)
  }
  return dataRoot
}

async function checkBodyFiles(root, sourceNotes, generatedNotes) {
  const failures = []
  const expected = new Set(sourceNotes.map(note => `notes/${note.id}.json`))
  const dataRoot = path.join(root, 'public', 'data')
  const actual = new Set((await walk(path.join(dataRoot, 'notes'))).filter(file => file.endsWith('.json')).map(file => posix(path.relative(dataRoot, file))))
  for (const relative of [...expected].filter(value => !actual.has(value)).sort()) failures.push(`missing body file: ${relative}`)
  for (const relative of [...actual].filter(value => !expected.has(value)).sort()) failures.push(`extra body file: ${relative}`)
  const generatedById = new Map(generatedNotes.map(note => [note.id, note]))
  for (const source of sourceNotes) {
    if (!generatedById.has(source.id) || !actual.has(`notes/${source.id}.json`)) continue
    const body = JSON.parse(await readFile(path.join(dataRoot, 'notes', `${source.id}.json`), 'utf8'))
    if (body.hashes?.en !== source.hashes.en || body.hashes?.zh !== source.hashes.zh) failures.push(`body hash mismatch: ${source.id}`)
    if (body.content?.en !== source.content.en || body.content?.zh !== source.content.zh) failures.push(`body content mismatch: ${source.id}`)
  }
  return failures
}

async function main() {
  const root = path.dirname(fileURLToPath(import.meta.url))
  const args = process.argv.slice(2)
  const check = args.includes('--check')
  const sourceAt = args.indexOf('--source')
  const sourceRepo = path.resolve(sourceAt >= 0 ? args[sourceAt + 1] : path.join(root, '..', 'deepseek-harness'))
  const notes = await scanNotes(path.join(sourceRepo, '.agents', 'notes'))
  const skills = await scanSkills(path.join(sourceRepo, '.agents', 'skills'))
  const revision = await sourceRevision(sourceRepo)
  reportInventory(notes)
  console.log(`  skills: ${skills.length}`)
  if (notes.invalid.length) throw new Error('Invalid Note-shaped sources found; see inventory above')
  if (!check) {
    const dataRoot = await writeData(root, skills, notes.records, revision)
    console.log(`BUILT ${dataRoot}`)
    return
  }
  const catalog = JSON.parse(await readFile(path.join(root, 'public', 'data', 'catalog.json'), 'utf8'))
  const generatedNotes = catalog.notes
  const generatedSkills = catalog.skills
  const noteRecon = reconcileRecords(notes.records, generatedNotes)
  const skillSource = skills.map(skill => ({ id: skill.id, hashes: { en: skill.hash, zh: skill.hash } }))
  const skillGenerated = generatedSkills.map(skill => ({ id: skill.id, hashes: { en: skill.hash, zh: skill.hash } }))
  const skillRecon = reconcileRecords(skillSource, skillGenerated)
  reportRecon('NOTES', noteRecon)
  reportRecon('SKILLS', skillRecon)
  const bodyFailures = await checkBodyFiles(root, notes.records, generatedNotes)
  if (catalog.sourceBranch !== 'master') bodyFailures.push(`catalog branch mismatch: ${catalog.sourceBranch}`)
  if (catalog.sourceRevision !== revision) bodyFailures.push(`catalog revision mismatch: ${catalog.sourceRevision} != ${revision}`)
  console.log(`BODY FILE RECONCILIATION\n  issues: ${bodyFailures.length}`)
  for (const failure of bodyFailures) console.log(`    ! ${failure}`)
  const failureCount = [...Object.values(noteRecon), ...Object.values(skillRecon)].reduce((sum, items) => sum + items.length, 0) + bodyFailures.length
  console.log(failureCount ? `RECON FAILED (${failureCount} issues)` : 'RECON OK')
  if (failureCount) process.exitCode = 1
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()
