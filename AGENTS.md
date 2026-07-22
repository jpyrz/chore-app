# Project Instructions

## Product

- Product: Choreline, a shared job board where people complete useful work and track what they earn.
- Primary user loop: A manager publishes work, a member claims and finishes it, a manager approves it, and the ledger records the earning.
- Launch model: Invite-only beta.
- Mobile-first target: 360–430 px, followed by tablet and desktop adaptations.

## Stack

- Client: React, Vite, TypeScript, React Router, TanStack Query.
- Styling: SCSS Modules with warm paper surfaces, tactile controls, rounded geometry, and the shared tokens in `src/styles/global.scss`.
- Backend: Supabase Auth and Postgres. Realtime is not currently used.
- Hosting: Netlify from GitHub `main`.
- PWA: Yes. Cache the app shell and immutable static assets only; authentication and data operations remain network-bound.

## Commands

- Install: `npm install`
- Develop: `npm run dev`
- Lint: `npm run lint`
- Type check: `npm run typecheck`
- Unit tests: `npm test`
- Component tests: `npm run test:component`
- End-to-end tests: `npm run cy:run`
- Production build: `npm run build`

## Backend and Security

- Store schema history in `supabase/migrations`.
- Enable RLS for browser-accessible tables and test cross-user isolation.
- Keep service-role keys, passwords, and tokens out of client code and Git.
- Put sensitive multi-record operations in trusted procedures/functions.
- Treat `ledger_entries` as append-only. An approved occurrence creates at most one earning through an idempotent database procedure.
- Claiming and approval must remain atomic. Never implement balance changes as client-composed table writes.
- Managed profiles may omit `auth_user_id`; their authenticated manager is responsible for actions performed on their behalf.

## Delivery

- Preserve unrelated user changes in a dirty worktree.
- Implement mobile layouts first and verify tablet/desktop adaptations.
- Run lint, type checking, unit tests, relevant Cypress tests, and a production build before handoff.
- Production deploys from `main`; branches receive Netlify previews.
- Do not push migrations or deploy production without confirming the intended Supabase and Netlify projects.
