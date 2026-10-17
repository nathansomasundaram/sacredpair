# Sacred Pair

A web app for people who are serious about finding a life partner and building a healthy relationship. Responsive on phones and desktops, and built so it can later be wrapped for the App Store and Google Play.

- **Discover**: four profiles chosen each week, revealed with the magic wand.
- **Details**: a person's full profile. Premium fields are visible only to Premium members.
- **Together**: once two people choose each other, they pick one path (grow a tree, build a house, or write a book) and work through nine levels together.
- **Chat**: private conversations that open only between connected people.
- **Profile**: your overview, Premium fields and settings.

## Stack

| Part | Choice |
|---|---|
| App | Next.js 16 (App Router, TypeScript), deployed on Vercel |
| Styling | Tailwind CSS 4 with design tokens in `src/app/globals.css` |
| Text and languages | next-intl. US English now; every word lives in `messages/<locale>.json` |
| Database, sign-in, files, live chat | Supabase (Postgres with Row Level Security, Auth, Storage, Realtime) |
| Tests | Vitest (unit and database rules), Playwright (pages in a browser) |
| Local testing | Docker: Supabase containers plus the app container |
| CI | GitHub Actions; Vercel creates a preview for every pull request |

## Run it locally

You need Node.js 22.12 or newer and Docker Desktop.

```bash
npm install
cp .env.example .env.local
npm run db:start          # starts Supabase in Docker and applies migrations
npm run dev               # http://localhost:3000
```

`npm run db:start` prints the local URLs and keys. If the keys differ from `.env.local`, copy them in.

| Local service | Address |
|---|---|
| App | http://localhost:3000 |
| Supabase Studio (browse the database) | http://localhost:54323 |
| Mailpit (emails sent locally) | http://localhost:54324 |

### Run the app in Docker instead

```bash
npm run db:start
docker compose up --build web                 # production-like build
docker compose --profile dev up dev           # hot reload, source mounted
docker compose --profile test run --rm e2e    # browser tests against the container
```

## Checks

```bash
npm run check        # lint (includes the no-hard-coded-text rule), types, unit tests
npm run test:db      # database privacy rules (needs npm run db:start)
npm run test:e2e     # browser tests on phone and desktop sizes
```

## Database

Migrations live in `supabase/migrations`. To change the schema, add a new migration file, then:

```bash
npm run db:reset     # rebuild the local database from all migrations
npm run db:types     # regenerate TypeScript types from the schema
npm run test:db
```

What the database guarantees on its own, whatever the app does:

- You can see a profile only if it is yours, in your weekly Discover set, or connected to you.
- Premium profile fields and extra photos are readable only by their owner or a Premium member.
- Nobody can make themselves Premium or ID-verified; only payment webhooks and trusted server code can.
- A choice stays secret until it is mutual; mutual choices open a connection automatically.
- Only the two people in a live connection can read or send its messages, including over live chat.
- Blocking ends the connection, closes the chat, and hides both profiles from each other.
- Deleting an account deletes everything that person owns.

## Deploying

1. Create a Supabase project and link it: `npx supabase link`, then `npx supabase db push`.
2. Import the GitHub repository in Vercel.
3. In Vercel project settings, add the variables from `.env.example` with the hosted Supabase values. Mark `SUPABASE_SECRET_KEY` as sensitive.
4. Pushes to `main` deploy to production. Pull requests get preview URLs.

## Writing text

Never type words straight into a component. Add a key to `messages/en-US.json` and use `useTranslations` (client) or `getTranslations` (server). The lint step fails on literal text in JSX. Store choices such as religion or smoking as codes and translate the label.

## Project layout

```
messages/                 translations, one file per language
src/app/                  pages (the five tabs are in src/app/(app)/)
src/components/           shell, brand mark, shared UI
src/i18n/                 locale settings
src/lib/supabase/         database clients for browser, server and proxy
src/proxy.ts              refreshes the sign-in session on each request
supabase/migrations/      database schema and privacy rules
tests/                    unit, db and e2e tests
```
