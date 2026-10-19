These templates are used by local Supabase (see supabase/config.toml).
For the hosted project, paste the same HTML into
Supabase dashboard > Authentication > Emails, or run `npx supabase config push`.
Links point to /auth/confirm, which asks the person to press a button before
the link is used, so email scanners that open links can't use them up.
