# Farms Directory

A curated directory of coffee farms and tea estates across India — with interactive maps, filtering, community submissions, and a PR-based publishing workflow.

Inspired by **[ooru.space](https://ooru.space)** — an open-source directory of public community spaces in India. We borrowed their three-column layout, minimalist design system, and the philosophy of keeping data as static files in git.

---

## Stack

- **Turborepo** — monorepo with Vercel-native build pipeline
- **apps/web** — Next.js 15 public directory (statically generated from JSON data files)
- **apps/admin** — Next.js 15 admin panel (protected by Supabase Auth)
- **packages/db** — shared Supabase types and client
- **Supabase** — stores pending submissions
- **Leaflet + OpenStreetMap** — map tiles, no API key required
- **GitHub API (Octokit)** — admin approval opens a PR, merge = deploy

## How publishing works

1. Someone submits a farm via the public form
2. Their address is geocoded via [Nominatim](https://nominatim.openstreetmap.org/) (OpenStreetMap, free)
3. The submission lands in the Supabase `submissions` table
4. An admin reviews it in `apps/admin` and clicks **Approve**
5. The server creates a GitHub PR that adds the farm to `data/coffee-farms.json` or `data/tea-farms.json`
6. Merging the PR triggers a Vercel rebuild — the farm appears on the site

No database queries at page load. No backend overhead. Just static JSON.

## Getting started

```bash
# 1. Install
pnpm install

# 2. Copy env vars
cp .env.example apps/web/.env.local
cp .env.example apps/admin/.env.local
# Fill in Supabase URL, anon key, service role key, and GitHub token

# 3. Run the schema
# Open Supabase Dashboard > SQL Editor > paste supabase/schema.sql > Run

# 4. Dev
pnpm dev        # web → :3000, admin → :3001
```

## Deploying to Vercel

Deploy each app as a separate Vercel project. In each project settings set **Root Directory** to `apps/web` or `apps/admin`. Vercel auto-detects the Turborepo.

Set all environment variables from `.env.example` in the Vercel project settings.

For the GitHub token used in the admin app, create a [fine-grained PAT](https://github.com/settings/personal-access-tokens/new) with:
- **Contents**: Read & Write
- **Pull requests**: Write

## Data

| File | Contents |
|------|----------|
| `data/coffee-farms.json` | Active coffee farms |
| `data/tea-farms.json` | Active tea estates |

Both files are the source of truth for the public site. They are updated exclusively through merged PRs — no direct database writes.

## License

- Data (`data/*.json`) — [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- Code — [MIT](./LICENSE)

---

*Inspired by [ooru.space](https://ooru.space) by the [Samagata Foundation](https://samagata.org)*


---

Arjun Aditya is building Gray Cup - a company which is around tea, coffee, and softwares. You can explore more below

• [https://graycup.org](https://graycup.org)

• [https://graycup.com](https://graycup.com)

• [https://arjunaditya.xyz](https://arjunaditya.xyz)

He still writes code, designs interfaces, and somehow keeps moving forward with a cup of tea or coffee in hand [ the ritual that keeps him sane when the burnout starts creeping in ]

Buy coffee or tea:

[https://graycup.in](https://graycup.in)

Bulk coffee or tea:

[https://b2b.graycup.in](https://b2b.graycup.in)

[https://bulkgreencoffee.com](https://bulkgreencoffee.com)

[https://bulkctc.com](https://bulkctc.com)
