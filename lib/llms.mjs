const DEFAULT_SITE_NAME = 'DeepSeek Harness Atlas'
const DEFAULT_ALTERNATE_NAME = 'DSH Atlas'

/**
 * Builds the `/llms.txt` index an assistant reads to decide whether this corpus answers a question.
 * It links the indexes and the machine-readable catalog rather than re-listing every Note URL —
 * the sitemap already carries those, and 1266 lines would bury the parts worth citing.
 */
export function llmsText({ catalog, siteUrl, siteName = DEFAULT_SITE_NAME, siteAlternateName = DEFAULT_ALTERNATE_NAME }) {
  const url = pathname => new URL(pathname, siteUrl).toString()
  const dates = catalog.notes.map(note => note.date).sort()
  const span = dates.length ? `${dates[0]} to ${dates.at(-1)}` : 'no Notes yet'
  const counts = `${catalog.notes.length} bilingual Agent Notes and ${catalog.skills.length} repository Skills`

  return `${[
    `# ${siteName} (${siteAlternateName})`,
    '',
    '> A visual field guide to DeepSeek Harness skills, architecture, and decisions.',
    '',
    `${siteAlternateName} is a development timeline and roadmap for DeepSeek Harness: ${counts},`,
    `tracked from ${catalog.sourceRepository} on ${catalog.sourceBranch} at revision`,
    `${catalog.sourceRevision}. Notes span ${span}. Every Note is a bilingual English/Chinese`,
    'pair recording one decision and the reasoning behind it.',
    '',
    '## Notes',
    '',
    `- [All Agent Notes](${url('/notes')}): the full corpus, newest first, grouped by month.`,
    `- [Interactive timeline](${url('/')}): the same corpus as a filterable timeline with focus mode.`,
    '',
    '## Skills',
    '',
    `- [All Skills](${url('/skills')}): repeatable workflows for reviewing, documenting,`,
    '  simplifying, translating, validating, and shipping DeepSeek Harness.',
    ...catalog.skills.map(skill => `- [${skill.title}](${url(`/skills/${skill.name}`)}): ${skill.description}`),
    '',
    '## Data',
    '',
    `- [catalog.json](${url('/data/catalog.json')}): every Note and Skill with its metadata,`,
    '  bilingual title and summary, and the path to its full body.',
    `- [sitemap.xml](${url('/sitemap.xml')}): every Note, Skill, and index page as a URL.`,
    `- [Source repository](${catalog.sourceRepository}): the upstream DeepSeek Harness checkout.`,
    '',
  ].join('\n')}\n`
}
