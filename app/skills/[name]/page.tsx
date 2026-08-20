import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Breadcrumbs, JsonLd, PageFrame } from '@/app/_components/page-frame'
import { RenderedMarkdown } from '@/app/_components/rendered-markdown'
import { getCatalog, getSkill, skillHref } from '@/lib/catalog'
import { absoluteUrl, isPublicSite, metaDescription, siteName } from '@/lib/site'

export const dynamicParams = false

interface SkillPageProps {
  params: Promise<{ name: string }>
}

export async function generateStaticParams() {
  const catalog = await getCatalog()
  return catalog.skills.map(skill => ({ name: skill.name }))
}

export async function generateMetadata({ params }: SkillPageProps): Promise<Metadata> {
  const { name } = await params
  const skill = await getSkill(name)
  if (!skill) return {}
  const description = metaDescription(skill.description)
  const pathname = skillHref(skill.name)
  return {
    title: `${skill.title} (${skill.name})`,
    description,
    keywords: ['DeepSeek Harness', 'agent skill', skill.name, skill.group, 'repeatable workflow'],
    alternates: isPublicSite ? { canonical: pathname } : undefined,
    openGraph: {
      type: 'article',
      title: `${skill.title} (${skill.name})`,
      description,
      siteName,
      url: isPublicSite ? pathname : undefined,
      tags: [skill.group, 'skill'],
    },
    twitter: { card: 'summary_large_image', title: `${skill.title} (${skill.name})`, description },
  }
}

export default async function SkillPage({ params }: SkillPageProps) {
  const { name } = await params
  const [catalog, skill] = await Promise.all([getCatalog(), getSkill(name)])
  if (!skill) notFound()

  const siblings = catalog.skills.filter(entry => entry.name !== skill.name)
  const sourceLink = `${catalog.sourceRepository}/blob/${catalog.sourceRevision}/${skill.sourcePath}`

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'HowTo',
        '@id': absoluteUrl(skillHref(skill.name)),
        name: skill.title,
        alternateName: skill.name,
        description: skill.description,
        inLanguage: 'en',
        step: skill.workflow.map((text, index) => ({ '@type': 'HowToStep', position: index + 1, name: text })),
        isPartOf: { '@type': 'WebSite', name: siteName, url: absoluteUrl('/') },
        about: { '@type': 'SoftwareSourceCode', name: 'DeepSeek Harness', codeRepository: catalog.sourceRepository },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: siteName, item: absoluteUrl('/') },
          { '@type': 'ListItem', position: 2, name: 'Repository Skills', item: absoluteUrl('/skills') },
          { '@type': 'ListItem', position: 3, name: skill.title, item: absoluteUrl(skillHref(skill.name)) },
        ],
      },
    ],
  }

  return (
    <>
      <JsonLd data={structuredData} />
      <PageFrame active="skills" sourceRepository={catalog.sourceRepository} sourceBranch={catalog.sourceBranch} sourceRevision={catalog.sourceRevision} noteCount={catalog.notes.length}>
        <article className="shell document">
          <Breadcrumbs trail={[{ name: 'Atlas', href: '/' }, { name: 'Skills', href: '/skills' }, { name: skill.title }]} />
          <div className="note-meta"><span className="badge category">{skill.group}</span><span className="skill-id">{skill.name}</span></div>
          <h1>{skill.title}</h1>
          <p className="document-summary">{skill.description}</p>
          <div className="source-path"><a href={sourceLink} target="_blank" rel="noreferrer">{skill.sourcePath}</a></div>

          <section className="document-body">
            <h2 className="language-rule">Workflow</h2>
            <ol className="workflow-steps">{skill.workflow.map(step => <li key={step}>{step}</li>)}</ol>
          </section>

          <section className="document-body">
            <h2 className="language-rule">Full instructions</h2>
            <RenderedMarkdown sourcePath={skill.sourcePath} sourceRepository={catalog.sourceRepository} sourceRevision={catalog.sourceRevision}>{skill.content}</RenderedMarkdown>
          </section>

          <section className="related">
            <h2>Other repository Skills</h2>
            <ul>{siblings.map(entry => <li key={entry.id}><Link href={skillHref(entry.name)}>{entry.title}</Link> <span className="related-date">{entry.name}</span></li>)}</ul>
          </section>
        </article>
      </PageFrame>
    </>
  )
}
