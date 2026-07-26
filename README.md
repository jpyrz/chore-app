# Loot Jar

Good work. Real loot.

Loot Jar is a mobile-first shared job board and family money ledger for families and other small crews. Managers publish one-time or repeating jobs, members claim and finish them, and approved work joins gifts, allowance, and other deposits in one transparent balance.

## Current build

Loot Jar uses real Supabase accounts and persistent Crew data. The launch workflow includes:

- Email/password signup, confirmation, sign-in, sign-out, and password recovery.
- Create a Crew or join one with an invite code.
- Owner, manager, and member roles.
- Parent-managed profiles with PIN entry and password-protected return to parent mode.
- One-time, daily, weekday, and weekly jobs.
- Claim, finish, approve, and append-only earnings ledger flows.
- Configurable claim windows that can automatically return unfinished jobs to the available pool.
- Jobs assigned directly to a specific member without a claim timer.
- Family-bank balances that combine approved chores, gifts, allowance, and other deposits.
- Manager-only purchase recording and balance corrections that preserve the audit trail.
- Savings goals measured against the child’s complete bank balance.

There is no payment processor: Loot Jar tracks money held by the family; it does not store or transfer real funds.

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

The schema includes RLS, trusted mutation functions, managed-profile PIN attempt limits, recurring occurrence generation, and an append-only ledger. Link only the intended project, then apply and test the migrations:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase migration list
npx supabase db push
npx supabase test db
```

## Hosting

`netlify.toml` configures the Vite build, immutable asset caching, and the React Router SPA fallback. Set both public Supabase environment variables in Netlify before deploying.
