# DeepSeek Harness Atlas

A visual field guide to the skills and bilingual Agent Notes in [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

## Local development

```sh
pnpm install
pnpm sync
pnpm dev
```

`pnpm sync` follows only the upstream `master` branch. It keeps a shallow clone under the gitignored `.cache/` directory, regenerates `public/data/`, prints excluded and non-canonical Markdown candidates, and reconciles every catalog record and Note body against the exact upstream commit.

Useful checks:

```sh
pnpm test
pnpm data:check
pnpm build
```

## Automated refresh

`.github/workflows/sync-harness.yml` runs daily and on demand. It fetches upstream `master`, runs generation, reconciliation, tests, and the production build, then commits `public/data/` only when the source changed. A connected Vercel project redeploys from that commit.

Set `NEXT_PUBLIC_SITE_URL` to the production origin when publishing outside Vercel. On Vercel, `VERCEL_PROJECT_PRODUCTION_URL` supplies canonical, Open Graph, sitemap, and robots URLs automatically.
