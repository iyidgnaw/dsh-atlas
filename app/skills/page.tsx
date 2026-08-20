import type { Metadata } from 'next'
import Link from 'next/link'

import { Breadcrumbs, JsonLd, PageFrame } from '@/app/_components/page-frame'
import { getCatalog, skillHref } from '@/lib/catalog'
import { absoluteUrl, isPublicSite, siteName } from '@/lib/site'

const description = 'The repeatable workflows DeepSeek Harness keeps in its own repository — code review, documentation standards, simplification hunts, translation, pre-push checks, and release chores.'

export const metadata: Metadata = {
  title: 'Repository Skills',
  description,
  keywords: ['DeepSeek Harness', 'agent skills', 'repository workflows', 'code review skill', 'documentation standards'],
  alternates: isPublicSite ? { canonical: '/skills' } : undefined,
  openGraph: { type: 'website', title: `Repository Skills | ${siteName}`, description, siteName, url: isPublicSite ? '/skills' : undefined },
  twitter: { card: 'summary_large_image', title: `Repository Skills | ${siteName}`, description },
}

export default async function SkillsIndexPage() {
  const catalog = await getCatalog()

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: `Repository Skills | ${siteName}`,
        description,
        url: absoluteUrl('/skills'),
        isPartOf: { '@type': 'WebSite', name: siteName, url: absoluteUrl('/') },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: catalog.skills.length,
          itemListElement: catalog.skills.map((skill, index) => ({ '@type': 'ListItem', position: index + 1, name: skill.title, url: absoluteUrl(skillHref(skill.name)) })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: siteName, item: absoluteUrl('/') },
          { '@type': 'ListItem', position: 2, name: 'Repository Skills', item: absoluteUrl('/skills') },
        ],
      },
    ],
  }

  return (
    <>
      <JsonLd data={structuredData} />
      <PageFrame active="skills" sourceRepository={catalog.sourceRepository} sourceBranch={catalog.sourceBranch} sourceRevision={catalog.sourceRevision} noteCount={catalog.notes.length}>
        <div className="shell index-head">
          <Breadcrumbs trail={[{ name: 'Atlas', href: '/' }, { name: 'Skills' }]} />
          <h1>Repository Skills</h1>
          <p className="index-lede">{description}</p>
          <div className="metrics"><span className="metric"><b>{catalog.skills.length}</b> Skills</span></div>
        </div>
        <div className="shell skills-grid">
          {catalog.skills.map(skill => (
            <article className="skill-card" key={skill.id}>
              <div className="skill-main">
                <div className="skill-id">{skill.name}</div>
                <h2><Link href={skillHref(skill.name)}>{skill.title}</Link></h2>
                <p className="description">{skill.description}</p>
                <div className="flow">{skill.workflow.map((step, index) => <div className="flow-step" data-step={index + 1} key={step}>{step}</div>)}</div>
              </div>
              <Link className="disclose" href={skillHref(skill.name)}>Read the full workflow</Link>
            </article>
          ))}
        </div>
      </PageFrame>
    </>
  )
}
