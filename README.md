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
npm run db:start          # starts Supabase in Docker (applies migrations the first time)
npm run dev               # http://localhost:3000
```

`npm run db:start` prints the local URLs and keys. If the keys differ from `.env.local`, copy them in.

| Local service | Address |
|---|---|
| App | http://localhost:3000 |
| Supabase Studio (browse the database) | http://localhost:54323 |
| Mailpit (emails sent locally: confirmations, password resets) | http://localhost:54324 |

### Run the app in Docker instead

```bash
npm run db:start
docker compose up --build web                 # production-like build
docker compose --profile dev up dev           # hot reload, source mounted
docker compose --profile test run --rm e2e    # browser tests against the container
```

## Signing in

- **Sign up** (`/signup`): email, password, mobile number, date of birth (18+), terms, optional dating-tips emails. Supabase sends a confirmation email.
- **Email links** go to `/auth/confirm`, which asks the person to press a button before using the link. Email security scanners that open links can't use them up.
- After confirming the email, members go on to **ID verification** (below).
- **Log in** (`/login`), **forgot password** (`/forgot-password`), **new password** (`/reset-password`).
- The proxy (`src/proxy.ts`) sends signed-out visitors from the app tabs to log in and returns them to the page they asked for.
- Error messages never reveal whether an email has an account.

## ID verification

After confirming their email, members verify a driver's license, passport or state ID with [Stripe Identity](https://stripe.com/identity): a photo or upload of the ID plus a selfie matched to it. Stripe charges $1.50 per verification, and the first 50 are free.

- `/verify-identity` explains the check and starts it. Failures are explained, and members can retry (at most 5 attempts a day).
- An ID showing someone under 18 is rejected for good.
- On success the date of birth from the ID replaces the one typed at sign-up and can't be edited afterwards. Sacred Pair stores only the result, the document type and that date. Images stay with Stripe.
- `/welcome` is the sign-up confirmation, shown once email and ID are both verified.
- Until verified, members can't open the app tabs.

**Locally** `IDENTITY_PROVIDER=simulated` (the default) replaces Stripe's screens with a test page where you pick the outcome. It is refused on the production site.

**With Stripe** set `IDENTITY_PROVIDER=stripe` and `STRIPE_SECRET_KEY`. In the Stripe dashboard (Developers > Webhooks) add `https://<your site>/api/webhooks/stripe-identity` for the `identity.verification_session.*` events, and put its signing secret in `STRIPE_IDENTITY_WEBHOOK_SECRET`. To test locally with Stripe test keys: `stripe listen --forward-to localhost:3000/api/webhooks/stripe-identity`.

Email wording lives in `supabase/templates/`. Local Supabase uses it automatically. For the hosted project, set it in the Supabase dashboard (Authentication > Emails) or run `npx supabase config push`, and set the Site URL to the live address (for example https://sacredpair.com).

## Checks

```bash
npm run check        # lint (includes the no-hard-coded-text rule), types, unit tests
npm run test:db      # database privacy rules (needs npm run db:start)
npm run test:e2e     # browser tests on phone and desktop sizes (needs npm run db:start)
```

## Database

Migrations live in `supabase/migrations`. **After pulling new code, run `npm run db:migrate`.** Restarting Supabase does not apply new migrations to an existing local database; `db:migrate` applies only the new ones and keeps your test accounts.

To change the schema, add a new migration file, then:

```bash
npm run db:reset     # rebuild the local database from all migrations
npm run db:types     # regenerate TypeScript types from the schema
npm run test:db
```

What the database guarantees on its own, whatever the app does:

- You can see a profile only if it is yours, in your weekly Discover set, or connected to you.
- Premium profile fields and extra photos are readable only by their owner or a Premium member.
- Nobody can make themselves Premium or ID-verified; only payment webhooks and trusted server code can.
- Nobody under 18 can be saved, and a member's phone number is readable only by them.
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
