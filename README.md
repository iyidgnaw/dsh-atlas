# DeepSeek Harness Atlas

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

## Architecture

The site is a statically prerendered Next.js application. The initial page receives only the Skill catalog and Note metadata; the Timeline renders in batches, and each bilingual Note body is fetched from its own static JSON file only when expanded.

Generated data is committed under `public/data/` so a Vercel build does not depend on a sibling DeepSeek Harness checkout:

```text
public/data/catalog.json
public/data/notes/<lifecycle>/<class>/<date>-<topic>.json
```

Every catalog snapshot stores the tracked branch and exact upstream commit. Source links in the UI point to that immutable revision rather than a moving branch head.

## Local development

Requirements: Node.js 24 and pnpm 11.

```sh
pnpm install
pnpm sync
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

`pnpm sync` maintains a shallow, gitignored clone at `.cache/deepseek-harness`, fetches only upstream `master`, regenerates `public/data/`, and runs reconciliation against the fetched commit.

## Data integrity

The scanner treats a Note as a bilingual English/Chinese pair under a canonical lifecycle and class path. It prints all excluded Markdown candidates and all compatible but non-canonical headers instead of silently dropping them.

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

[`sync-harness.yml`](.github/workflows/sync-harness.yml) runs daily at 03:17 UTC and can also be started manually. It:

1. fetches `deepseek-ai/deepseek-harness@master`;
2. regenerates and reconciles the data;
3. runs tests and the production build;
4. commits `public/data/` only when upstream content changed.

Once this repository is connected to Vercel, each automated data commit triggers a fresh deployment.

## Deploying to Vercel

Import this repository into Vercel and keep the detected Next.js defaults. Vercel provides `VERCEL_PROJECT_PRODUCTION_URL`, which the app uses for canonical metadata, Open Graph URLs, `robots.txt`, and `sitemap.xml`.

For another hosting provider, set the public origin explicitly:

```sh
NEXT_PUBLIC_SITE_URL=https://atlas.example.com pnpm build
```

The production build also generates an Open Graph image and JSON-LD describing the Atlas and its relationship to the DeepSeek Harness source repository.
