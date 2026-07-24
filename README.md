# Common Scale

Common Scale is a static Next.js reference app for comparing electricity-source safety, lifecycle CO₂, land use, and cost on a shared scale.

## Local setup

```bash
npm install
npm run validate:data
npm test
npm run build
```

The app is configured for static export with `output: 'export'` in `next.config.ts`. A successful build writes static files to `out/`.

## Data workflow

Source coefficients live in `src/data/sources.json` and are hand-curated with per-field source IDs from `src/data/citations.json`.

Country mix data can be refreshed from OWID with:

```bash
npm run data:refresh
```

That command downloads OWID's energy CSV, selects the latest complete country mix per ISO code, writes `src/data/countries.json`, writes aggregate rows to `src/data/regions.json`, updates `src/data/meta.json`, and runs data validation.

## Vercel deployment

This repo includes `vercel.json` so Vercel uses:

- Framework preset: Next.js
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `out`

In the Vercel dashboard, import the GitHub repository, keep the project root as the repository root, and deploy. Because the app uses static export and committed data, it does not need serverless functions, runtime API routes, a database, or environment variables for the current implementation.

## Configuring a GitHub push remote

If the repository has no remote, create or choose a GitHub repository, then run one of these from the repo root:

```bash
# HTTPS
 git remote add origin https://github.com/<owner>/<repo>.git
 git branch -M main
 git push -u origin main
```

```bash
# SSH
 git remote add origin git@github.com:<owner>/<repo>.git
 git branch -M main
 git push -u origin main
```

If a remote already exists but points elsewhere:

```bash
git remote -v
git remote set-url origin git@github.com:<owner>/<repo>.git
git push -u origin HEAD
```

After the first push, Vercel can be connected to that GitHub repository and will deploy future pushes automatically.
