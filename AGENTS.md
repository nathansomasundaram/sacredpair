<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Sacred Pair conventions

- Read `README.md` first. Requirements come from `../docs/Sacred Pair - Requirements.xlsx`.
- Build page by page. Each step: schema migration (if needed) + `tests/db` checks, page UI, translations, e2e test.
- No literal text in JSX. Add keys to `messages/en-US.json`. Store choices as codes; height and distance in metric.
- Premium gating is enforced by Row Level Security, never only in the UI.
- Use logical CSS (`ms-`, `pe-`, `start-`, `end-`) so right-to-left languages work.
- Design tokens are in `src/app/globals.css`: ink, paper, mist, line, covenant (actions), ring (pair mark and Premium only), leaf (Together).
- Before finishing: `npm run check`, `npm run test:db`, `npm run build`, `npm run test:e2e`.
