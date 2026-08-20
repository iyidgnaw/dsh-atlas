# DeepSeek Harness Atlas

**Live: [dsh-atlas.vercel.app](https://dsh-atlas.vercel.app)**

A development timeline and roadmap for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), reconstructed from its repository-native Skills and bilingual Agent Notes.

The Atlas follows upstream `master`, records the exact source commit behind every generated snapshot, and turns the decision corpus into an interactive view for learning how the harness evolved.

## What you can explore

- A chronological Git-tree-style timeline with one node per Agent Note.
- Implemented and archived decisions in green, rejected proposals in red, and active proposals in amber.
- Multi-select filters for architecture, bug fixes, features, process, simplification, and testing.
- English and Chinese at both global and per-Note level.
- Focus mode that expands one Note across the tree, then zooms out on scroll or a click in the surrounding Timeline region.
- Internal Agent Note links that navigate to and repeatedly highlight the destination node.
- Eleven repository Skills with their purpose, workflow, source, and full instructions.
- A standalone page per Note and per Skill, reachable from the ↗ permalink on any card.
- A dot-matrix sea behind the page, with a whale that dives when you scroll down and climbs when you scroll up.

## Routes

| Route | Contents |
| --- | --- |
| `/` | The interactive explorer: timeline, filters, focus mode |
| `/notes` | Every Agent Note, newest first, grouped by month |
| `/notes/<lifecycle>/<class>/<date>-<topic>` | One Note, both languages, with adjacent and related Notes |
| `/skills` | All repository Skills |
| `/skills/<name>` | One Skill: workflow steps and full instructions |

The explorer is a single client-rendered view, so the standalone routes exist to make the corpus
readable without JavaScript and indexable by search engines. `next build` prerenders all of them —
currently 742 static pages.

## Architecture

The site is a statically prerendered Next.js application. The explorer's initial page receives only the
Skill catalog and Note metadata; the Timeline renders in batches, and each bilingual Note body is
fetched from its own static JSON file only when expanded. The standalone Note and Skill routes take
the opposite approach: they render Markdown on the server so the full text ships in the HTML, and
cross-Note references in that Markdown become real links between Atlas pages.

Generated data is committed under `public/data/` so a Vercel build does not depend on a sibling
DeepSeek Harness checkout:

```text
public/data/catalog.json
public/data/notes/<lifecycle>/<class>/<date>-<topic>.json
```

Every catalog snapshot stores the tracked branch and exact upstream commit. Source links in the UI
point to that immutable revision rather than a moving branch head.

### Background

`app/_components/ocean-current.tsx` fills the viewport with one grid of dots, animated by two crossing
swells. A whale silhouette is rasterised once into a mask; each frame, every dot is inverse-transformed
into the whale's local frame and drawn slightly heavier when it lands inside. The whale is therefore made
of the same sea rather than layered on top of it. Scroll velocity drives its depth and turns it nose-down
or nose-up, and its body undulates perpendicular to whichever way it is swimming. It honours
`prefers-reduced-motion` by rendering a single static frame.

## Search engine optimisation

- Per-route `title`, `description`, `canonical`, Open Graph, and Twitter metadata, with a shared title template.
- JSON-LD: `WebSite` and `Dataset` on the home page, `CollectionPage` on the indexes, `TechArticle` per
  Note, `HowTo` per Skill, and a `BreadcrumbList` on every nested page.
- `sitemap.xml` lists all 737 URLs with per-Note `lastModified` dates; `robots.txt` advertises it.
- Both languages ship in the HTML of a Note page, marked with `lang` attributes.

## Local development

Requirements: Node.js 24 and pnpm 11.

```sh
pnpm install
pnpm sync
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

`pnpm sync` maintains a shallow, gitignored clone at `.cache/deepseek-harness`, fetches only upstream
`master`, regenerates `public/data/`, and runs reconciliation against the fetched commit.

## Data integrity

The scanner treats a Note as a bilingual English/Chinese pair under a canonical lifecycle and class path.
It prints all excluded Markdown candidates and all compatible but non-canonical headers instead of
silently dropping them.

Reconciliation fails on any:

- missing, extra, or duplicate Note;
- missing language counterpart;
- catalog or body hash mismatch;
- stale or extra generated body file;
- generated revision that differs from the scanned upstream commit.

Run the checks independently with:

```sh
pnpm test
pnpm data:check
pnpm lint
pnpm build
```

## Automated refresh

[`sync-harness.yml`](.github/workflows/sync-harness.yml) runs daily at 03:17 UTC and can also be started
manually. It:

1. fetches `deepseek-ai/deepseek-harness@master`;
2. regenerates and reconciles the data;
3. runs tests and the production build;
4. commits `public/data/` only when upstream content changed.

Each automated data commit triggers a fresh Vercel deployment, which reprerenders every Note page and
regenerates the sitemap.

## Deployment

The site is deployed on Vercel as the personal-account project `dsh-atlas`, connected to this GitHub
repository: pushes to `main` go to production, other branches get preview URLs.

Vercel provides `VERCEL_PROJECT_PRODUCTION_URL`, which the app uses for canonical metadata, Open Graph
URLs, `robots.txt`, and `sitemap.xml`. For another hosting provider, set the public origin explicitly:

```sh
NEXT_PUBLIC_SITE_URL=https://atlas.example.com pnpm build
```

The production build also generates the Open Graph image and the favicon.
