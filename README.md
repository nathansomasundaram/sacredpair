# Sacred Pair

A web app for people who are serious about finding a life partner and building a healthy relationship. Responsive on phones and desktops, and built so it can later be wrapped for the App Store and Google Play.

- **Discover**: four profiles chosen each week, revealed with the magic wand.
- **Details**: a person's full profile. Premium fields are visible only to Premium members.
- **Together**: once two people choose each other, they pick one path (grow a tree, build a house, or write a book) and work through nine levels together.
- **Chat**: private conversations that open only between connected people.
- **Profile**: your overview, Premium fields and settings.

## Stack

| Part                                | Choice                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------- |
| App                                 | Next.js 16 (App Router, TypeScript), deployed on Vercel                 |
| Styling                             | Tailwind CSS 4 with design tokens in `src/app/globals.css`              |
| Text and languages                  | next-intl. US English now; every word lives in `messages/<locale>.json` |
| Database, sign-in, files, live chat | Supabase (Postgres with Row Level Security, Auth, Storage, Realtime)    |
| Tests                               | Vitest (unit and database rules), Playwright (pages in a browser)       |
| Local testing                       | Docker: Supabase containers plus the app container                      |
| CI                                  | GitHub Actions; Vercel creates a preview for every pull request         |

## Run it locally

You need Node.js 22.12 or newer and Docker Desktop.

```bash
npm install
npm run db:start          # starts Supabase in Docker (applies migrations the first time)
npm run env:local         # writes its URLs and keys into .env.local and .env
npm run dev               # http://localhost:3000
npm run seed:demo         # optional: 12 fictional members so Discover has people to show
```

Keys are never written into the code. `npm run env:local` reads them from your running Supabase. Neither `.env.local` nor `.env` is committed, and GitHub's secret scanning blocks pushes that contain keys.

| Local service                                                 | Address                |
| ------------------------------------------------------------- | ---------------------- |
| App                                                           | http://localhost:3000  |
| Supabase Studio (browse the database)                         | http://localhost:54323 |
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

## Profile

- `/profile` shows the member's Profile Overview exactly as others will see it, with a checklist of anything missing before they can be introduced.
- `/profile/edit` edits name, city and state, about me (up to 1,000 characters) and up to 5 character traits. Age comes from the verified ID and can't be edited.
- **Photos:** the browser shrinks large photos before sending them. The server then checks the actual file contents (JPEG, PNG or WebP, at least 400 px), turns the photo upright, removes all metadata including GPS location, resizes it to 1600 px and stores it as WebP in a private bucket. Photos are shown through links that expire after an hour.
- A profile counts as complete (`profiles.is_complete`) once it has a name, city, state and photo. Only complete profiles will appear in Discover.
- Traits and states are stored as codes. Their labels live in `messages/en-US.json`, and the allowed codes in `src/lib/profile/options.ts` and the database.

## Profile - Premium

`/profile/premium` edits the part of a profile only Premium members can see (any member can fill theirs in):

- **More photos:** up to 6, cleaned the same way as the main photo.
- **Video:** MP4 or MOV, up to 60 seconds and 50 MB. The browser uploads it straight to private storage with a one-time link (hosting limits app uploads to a few MB). The server then checks it is a real MP4/MOV, reads its length, and blanks the metadata boxes where phones record GPS location and device details, without re-encoding. The uncleaned upload is always deleted.
- **Prompts:** up to 3 from a fixed list, answers up to 200 characters.
- **Details:** height (feet and inches in US English, stored in cm), profession, education, marital status, children, family plans, zodiac, languages, religion, ethnicity, smoking, drinking, working out, pets, and interests (hobbies, sports, food and drink, entertainment, travel, music, books).
- Religion and ethnicity are optional and offer "Prefer not to say", which is never shown.

All choices are stored as codes, listed once in `src/lib/profile/premium-options.ts`. The database accepts only those codes (`supabase/migrations/20261021000000_profile_premium.sql`). Adding a choice means adding it to the options file, `messages/en-US.json` and a new migration.

## Discover

Each week a member taps the magic wand to meet **four** people. Those four stay the same all week (tapping again never swaps anyone), and four new people arrive every Monday at midnight US Eastern time. If fewer than four people suit a member, the wand stays available that week to fill the empty places as new members join; if nobody suits yet, the week isn't used up.

Who can be introduced (`supabase/migrations/20261022000000_discover.sql`):

- Verified ID, a complete profile (name, city, state, photo), not banned, visible.
- Never someone either person blocked, already connected, already chosen or passed, or introduced before.
- "Looking for" and age range must suit **both** people once they set them in Settings (until then they don't narrow anything).
- Nearest first: same city, then same state, then anyone, in random order. Distance-based matching replaces this once members' locations are stored.

The database does the choosing (`reveal_introductions()`), so the four-a-week limit can't be bypassed from the browser. Each card opens `/details/{id}`, which only works for people introduced to the member or connected with them; the Premium part shows only to Premium members.

`npm run seed:demo` adds 12 fictional, verified members to your **local** Supabase (it refuses to run against anything else). Log in as any of them with `<first name>@demo.sacredpair.test` and password `DemoMember2026`. `npm run seed:demo -- --remove` takes them out again.

## Details and Premium

The Details tab lists everyone whose full profile a member can open (this week's introductions; connections join with Chat). `/details/{id}` shows the Profile Overview to everyone allowed to see that person, then:

- **Premium members** see the Premium part: more photos, video, prompts, details and interests.
- **Free members** see how much the person shared ("2 more photos", "An introduction video", "1 prompt answered", "5 more details"), never the content, and a **Know more** button that opens the upgrade screen (`/upgrade`). The counts come from `premium_teaser()` (`supabase/migrations/20261023000000_details.sql`), which answers only for people the member may see. Premium content itself is still guarded by Row Level Security, so it never reaches a free member's browser.

Premium status is one record per member (`entitlements`); expiry takes effect automatically. Real payments arrive in the payments step (Stripe on the web, RevenueCat for the app stores). Until then `PAYMENTS_PROVIDER` decides what the upgrade screen offers:

| `PAYMENTS_PROVIDER`                           | Upgrade screen                                                                                                        |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `simulated` (default locally and on previews) | **Start test Premium (30 days)**, no payment. Recorded as source `simulated`, and can be ended again from `/upgrade`. |
| `none` (default on the production site)       | "Premium opens soon". Test Premium is refused on production.                                                          |

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
