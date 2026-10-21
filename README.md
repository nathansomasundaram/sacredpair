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

### Sample data

`npm run seed:demo` fills your **local** Supabase with fictional, verified members (it refuses to run against anything else). Their data lives in `scripts/demo/members.mjs`.

- **12 members to meet**, with complete overviews and abstract pictures (no real people). Daniel, Grace, Marcus, Naomi, Elijah, Samuel, Jordan and Hannah have full Premium profiles: extra photos, prompts, details and interests, and most have a short demo video. Ruth and Leah have partial ones; Isaac and Caleb have none, which shows the "hasn't added more yet" state.
- **Three logins for testing**, kept out of everyone's introductions:

| Log in as                     | Membership          | What you see on Details                                              |
| ----------------------------- | ------------------- | -------------------------------------------------------------------- |
| `taylor@demo.sacredpair.test` | Free                | Counts of what each person shared, **Know more**, the upgrade screen |
| `morgan@demo.sacredpair.test` | Premium (test mode) | Full Premium profiles                                                |
| `avery@demo.sacredpair.test`  | Free, admin         | Moderation tools at `/admin` (see [Moderation](#moderation))         |

The password for every demo member is `DemoMember2026`; you can log in as any of them (`grace@demo.sacredpair.test` and so on).

| Command                         | Does                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run seed:demo`             | Adds the demo members, or resets their profiles to the sample data                                                                               |
| `npm run seed:demo -- --fresh`  | Also clears Taylor's and Morgan's introductions, so the magic wand works again (introductions never repeat, so 12 members last 3 taps otherwise) |
| `npm run seed:demo -- --remove` | Removes every demo member                                                                                                                        |

## Details and Premium

The Details tab lists everyone whose full profile a member can open (this week's introductions; connections join with Chat). `/details/{id}` shows the Profile Overview to everyone allowed to see that person, then:

- **Premium members** see the Premium part: more photos, video, prompts, details and interests.
- **Free members** see how much the person shared ("2 more photos", "An introduction video", "1 prompt answered", "5 more details"), never the content, and a **Know more** button that opens the upgrade screen (`/upgrade`). The counts come from `premium_teaser()` (`supabase/migrations/20261023000000_details.sql`), which answers only for people the member may see. Premium content itself is still guarded by Row Level Security, so it never reaches a free member's browser.

Premium status is one record per member (`entitlements`); expiry takes effect automatically. Real payments arrive in the payments step (Stripe on the web, RevenueCat for the app stores). Until then `PAYMENTS_PROVIDER` decides what the upgrade screen offers:

| `PAYMENTS_PROVIDER`                           | Upgrade screen                                                                                                        |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `simulated` (default locally and on previews) | **Start test Premium (30 days)**, no payment. Recorded as source `simulated`, and can be ended again from `/upgrade`. |
| `none` (default on the production site)       | "Premium opens soon". Test Premium is refused on production.                                                          |

## Connect and Chat

**Connect.** At the bottom of every profile a member can **Choose** or **Pass**. Choices are private: the other person learns of one only if they choose back, and then the database opens a connection (`handle_choice` in `supabase/migrations/20261017000000_init.sql`). Until then either choice can be changed. Connections show in the Details tab under "Your connections".

**Chat.** Only the two members of a live connection can read or send its messages; nobody can message a stranger. These rules are in the database (Row Level Security), and Supabase Realtime applies the same rules to live updates, so nobody else can listen in.

- **Live:** new messages and read receipts arrive instantly through Supabase Realtime. If a network blocks Realtime, the conversation checks every few seconds instead, so it still works.
- **Read receipts and unread counts:** your last message shows "Sent" or "Read". The Chat list shows unread counts, and the Chat tab shows a badge.
- **Limits:** messages are 1–2000 characters, and each member can send at most 30 a minute.
- **Ending:** **End connection** (unmatch) or **Block** closes the conversation for both people for good; choosing again doesn't reopen it. Blocking also hides both profiles from each other.
- **Reports** (`/safety/{id}`, from the conversation menu or the bottom of a profile): a reason, optional details, and optionally a block too. A report can only be about someone the member has met, and it is linked to the conversation so moderators can read it. The person reported is never told.
- **Not end-to-end encrypted**, as recommended in the requirements: messages are encrypted in transit and at rest, and moderators can read a reported conversation.
- **Not yet:** push, email and SMS notifications for new messages arrive with notification settings in the Settings step.

The demo data (`npm run seed:demo`) connects Morgan with Grace (2 unread messages) and Naomi, and Taylor with Daniel (1 unread) and Jordan (no messages yet).

## Together

Two connected people take one journey together: **Grow a tree**, **Build a house** or **Write a book**.

- **Choosing a path:** one person suggests a path and the other accepts it, or suggests a different one. A couple has one path at a time. Either person can leave it, and then they can choose again from level 1. Ending the connection ends the journey too.
- **Levels:** each path has the nine levels from the requirements workbook. A level is four questions, mixing the craft itself (botany, construction, writing) with what it teaches about relationships:
  - choose the answer
  - true or false
  - put steps in order
  - match the pairs
- **Explanations and scoring:** every answer is explained. Anything missed comes back once at the end, so nobody fails. The score counts first-try answers, and replaying a level keeps the best score.
- **Talk about it:** each level ends with a question for the couple, with a link straight to their Chat.
- **Moving forward together:** levels go in order, and each person can be at most one level ahead of the other. The shared picture (a tree, a house or a book, in 10 stages) grows only when both have finished a level. The database enforces these rules (`complete_level()` in `supabase/migrations/20261025000000_together.sql`), and progress is saved there, not in the browser.
- **Lessons are content files**, one per level per language: `content/journey/en-US/grow-a-tree/level-1.json` and so on, plus a `path.json` describing each path.
  - To add a language, copy the `en-US` folder and translate it. Until a level is translated it falls back to US English.
  - Question types: `choice` (options, `answer` = the right option's index), `truefalse`, `order` (`items` in the right order) and `match` (`pairs`). Answers are shuffled on screen.
  - `npm test` checks that every lesson file is complete and answerable.

The demo data puts Morgan and Grace on Grow a tree (Morgan is a level ahead). Naomi has suggested Write a book to Morgan, and Taylor and Daniel are on Build a house, where it's Taylor's turn.

## Settings

Settings opens from the Profile tab and has four pages.

**Dating preferences** (`/settings/preferences`)

- **Who to meet:** I am, Looking for, age range and distance work both ways. Someone is introduced only if each person suits what the other is looking for.
- **Distance:** a ZIP code becomes the approximate center of that ZIP area, using US Census data through the `us-zips` package. It's stored privately (`account_private`), measured in km and shown in miles. Members without a ZIP code are matched by state instead.
- **Show me in Discover:** turning it off pauses the member. Nobody new is introduced to them, and their connections and chats continue.
- **Filters (Premium):** religion, ethnicity, family plans, smoking, drinking and pets.
  - Each filter means "show only these". Someone who hasn't answered, or chose "prefer not to say", is never filtered out by that question.
  - Free members see the filters but can't change them. Discover applies them only while the member is Premium; saved choices are kept if Premium lapses.

**Notifications** (`/settings/notifications`): the member picks _how_ (email, push, text) and _what_ (new messages, new connections, Together, plus news emails).

- **What notifications say:** they never include what someone wrote.
- **How often:** email and text send at most one per conversation per hour. Push sends every message. Sending happens after the response (`src/lib/notify`), so it never slows anyone down, and every send is logged in `notification_log`.
- **Email:** over SMTP (`SMTP_URL`). Locally it goes to Mailpit with no setup.
- **Push:** web push, using `public/sw.js` and VAPID keys from `npm run push:keys`. It's turned on per device. On iPhone and iPad it works once Sacred Pair is added to the Home Screen.
- **Text:** through Twilio (`SMS_PROVIDER=twilio`) and only to a verified phone number. Locally it's `simulated`: texts are logged, and the verification code appears on screen.

**Account** (`/settings/account`)

- **Change email:** Supabase sends confirmation links to both the new and the current address.
- **Phone number:** change it, then verify it with a 6-digit code. Codes last 10 minutes, allow 5 tries, and can be requested at most once a minute.
- **Change password:** needs the current password.
- **Delete account:** needs the password and typing DELETE. It removes everything: photos, video, messages, journeys and settings.

**Membership & payment** (`/settings/membership`): shows the plan and test-mode Premium. Payment management (Stripe customer portal, or the App Store and Google Play for in-app subscriptions) is added in the payments step.

## Public pages

The public site (`src/app/(public)/`) is everything a visitor sees before joining: the home page, **FAQ** (`/faq`), **Dating tips** (`/tips`, six articles), **Stories** (`/stories`), **Privacy Policy** (`/privacy`) and **Terms and Conditions** (`/terms`). Signed-in members see the same pages with an "Open Sacred Pair" button. `/sitemap.xml` lists them; `robots.txt` keeps search engines out of the app and `/admin`.

- **Wording** lives in `content/site/en-US/` as JSON (policies, FAQ, tips), so it can be edited without touching code and translated later.
- **Privacy Policy and Terms are drafts.** They show a "This is a draft" notice and contain `[placeholders]` (company legal name, mailing address, governing state, and so on). Have a lawyer review them, fill in the placeholders, then set `"status": "final"` and update `"updated"` in `privacy.json` and `terms.json`; the notice disappears.
- **Stories (testimonials) are real members' words only.** Members submit one in Settings → Share your story, agreeing that it may be shown publicly. Nothing appears until staff publish it, and authors can take it down at any time. Until the first is published, `/stories` says "Stories are on their way" and the home page leaves the section out.

## Moderation

`/admin` is for staff only; everyone else gets a 404. Moderators can do everything except manage staff, which needs an admin.

| Page         | For                                                                                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview     | Open reports, stories waiting, suspended members, recent activity                                                                               |
| Reports      | Each report with the conversation between the two people; mark reviewing, resolve, dismiss, or suspend the reported member                      |
| Members      | Search by email, name or ID; see their profile, photos, video and reports; remove a photo, the video, About me or prompts; suspend or reinstate |
| Stories      | Publish or decline members' stories, or take a published one down                                                                               |
| Activity log | Every moderation action: who, what, when and the note                                                                                           |
| Staff        | Add or remove moderators and admins (admins only)                                                                                               |

- **Suspending** signs the member out, blocks signing in, ends their connections and hides them from Discover. They see a "Your account is suspended" page and get an email. Reinstating lets them sign in again; ended connections stay ended.
- **Removing content** deletes the file or text and emails the member that something was removed.
- Every action is recorded in `moderation_actions` with an optional note.

Add the first admin from the command line (needs `SUPABASE_SECRET_KEY` in `.env.local`, so it works against your own project only):

```bash
npm run staff -- add you@example.com admin      # or moderator
npm run staff -- remove you@example.com
npm run staff -- list
```

Locally, `npm run seed:demo` also adds **avery@demo.sacredpair.test**, an admin, with one demo report (Ruth about Caleb), one story waiting for review and one published. All of it is fictional and local only.

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
src/app/                  pages (the five tabs are in src/app/(app)/, the public site
                          in src/app/(public)/, moderation in src/app/admin/)
content/                  Together levels and public-site wording (JSON)
src/components/           shell, brand mark, shared UI
src/i18n/                 locale settings
src/lib/supabase/         database clients for browser, server and proxy
src/proxy.ts              refreshes the sign-in session on each request
supabase/migrations/      database schema and privacy rules
tests/                    unit, db and e2e tests
```
