# ONight local development

Nothing in this workflow pushes Git changes or connects to the VPS. The dashboard
and store use the same local API and PostgreSQL database. Store payments remain
cash on delivery.

Create an ignored `.env.local` at the repository root:

```dotenv
ADMIN_EMAIL=owner@onight.local
ADMIN_PASSWORD=choose-a-local-demo-password
AUTH_SECRET=choose-a-long-local-only-secret
```

Then run `pnpm install` and `pnpm dev` from the repository root. `pnpm
dev:local` is retained as an explicit alias for the same local workflow.

- Dashboard: http://localhost:1420
- Store: http://localhost:3000
- API: http://localhost:4000/api/v1
- PostgreSQL: 127.0.0.1:54329, database/user `onight`

To run only PostgreSQL and the API, use `pnpm dev:api`. This is the supported
API-only command because it starts the embedded database and injects its
`DATABASE_URL`; the deployment-oriented root `.env` is not used for local
database credentials.

PostgreSQL binaries are a development-only dependency; no Docker or system service
is required. The first run applies migrations and imports the existing demo seed,
including the demo products/images. Later runs preserve edits and run migrations
only. Data lives in ignored `.local/postgres`; stopping the command does not erase it.
Keep the local password stable after initialization: it also authenticates the
local database. Never reuse production credentials.

Use `pnpm dev:local --seed` only to deliberately reapply the demo seed (including
resetting the local owner's password). If the existing dashboard dev server is
already running against localhost:4000, use `pnpm dev:local --reuse-dashboard`.

## UI and access rules

Dashboard styles are Tailwind v4 utilities. `src/styles.css` only imports fonts and
Tailwind and defines theme tokens. `src/lib/ui.ts` contains reusable utility recipes
and merges overrides with `tailwind-merge`; semantic class names are variant hooks,
not CSS rules. Quicksand is retained. ONight uses coral `#ff4455` and pink `#f66897`,
with darker text/hover accents and semantic status colors.

`OWNER` is the administrator role. Administrators can edit their own name using
the sidebar profile or Équipe & rôles, and rename non-admin members in the team
table. Peer-admin accounts are read-only, enforced in the API inside a transaction.
Role/password changes cannot bypass the peer-admin restriction. Self-suspension
and self-demotion are rejected to prevent lockout. Other roles cannot edit users.

Run `pnpm typecheck`, `pnpm test`, and `pnpm build` for verification.
