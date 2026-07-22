# Choreline

Good work. Real rewards.

Choreline is a mobile-first shared job board for families and other small crews. Managers publish one-time or repeating jobs, members claim and finish them, and approved work is recorded in a transparent earnings ledger.

## Current build

The app currently runs as an interactive product demo backed by local browser storage. Use the profile switcher in the top-right to move between Mia’s member experience and James’s manager experience:

1. Claim an available job as Mia.
2. Mark it finished.
3. Switch to James and approve it.
4. Switch back to Mia to see the updated balance and ledger.

The Supabase client boundary and production schema migration are included, but the UI intentionally stays on the local demo repository until a hosted Supabase project is linked.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Environment variables:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Do not expose a Supabase service-role key in any `VITE_` variable.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Cypress is configured for component and end-to-end coverage:

```bash
npm run test:component
npm run cy:run
```

## Backend

Schema history lives in `supabase/migrations`. The initial migration includes Crew roles, managed profiles, recurring job templates, job occurrences, append-only ledger entries, RLS policies, and atomic functions for claiming, completing, approving, and recording payouts.

Apply the migration only after linking the intended Supabase project and reviewing the target:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase migration list
supabase db push
```

## Hosting

`netlify.toml` configures the Vite build, immutable asset caching, and the React Router SPA fallback. Production deployment is intentionally not connected yet.
