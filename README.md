# WardLens

**WardLens helps communities follow local development and take part in decisions that affect their neighbourhoods.** It brings project information, public budget records, community proposals, and resident feedback together in one accessible place. Residents can explore projects by ward, track progress and milestones, support proposals, and ask questions. Public officers and oversight reviewers can record decisions, publish financial updates, respond to feedback, and maintain an audit trail.

WardLens is designed to make local project information easier to understand and follow, from an initial community idea through review, funding, delivery, and completion. Its responsive interface, accessible forms, and installable progressive web app make key information available across desktop and mobile devices.

The included ward names, residents, project statuses, budgets, and expenditure records are **illustrative seed data** for local evaluation. They are not official county records, and financial figures have not been independently verified.

## What works in this MVP

- Resident registration and login using hashed passwords and signed JWT sessions.
- Role-based API permissions for residents, officers, oversight reviewers, and administrators.
- Project register, search, and filters by status, category, and ward.
- Resident proposal submission, unique community support votes, and project feedback.
- Project lifecycle status changes with required decision notes and audit logs.
- Project milestones with status and evidence URL fields.
- Published budget allocation, expenditure, and adjustment records; financial summaries are updated by the API.
- Ward pages and public finance explorer.
- Resident dashboard with proposals, supported projects, and feedback responses.
- Management console for review decisions, milestones, financial records, feedback responses, contact inbox, and audit trail.
- Persisted SQLite data, seeded demo accounts, API health endpoint, and automated integration tests.
- Installable PWA shell with service-worker caching for the app shell and previously opened same-origin pages. API responses are intentionally not cached.

## Requirements

- Node.js 22 or newer recommended.
- npm 10 or newer.

## Run locally

1. Open a terminal in `wardlens/`.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env`. The defaults work for local development, but change the secrets before deploying.
4. Start both the API and web app together:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:5173`. The API health endpoint is available at `http://localhost:4000/api/health`. The terminal should show that both services are listening; keep it open while using the app.

On Windows, after installing dependencies and configuring `.env`, you can double-click `start-wardlens.bat` to start both services and launch the site in your browser. `npm run dev:web` is available when you intentionally want to run only the frontend.

When no Turso credentials are configured, SQLite creates `data/wardlens.sqlite` automatically and seeds example wards, projects, budget records, milestones, and local development accounts on first run. This local adapter is retained for development and integration tests. Set both `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` to use Turso instead; the API creates the schema and initial example records on its first connection. A partial Turso configuration is rejected rather than silently falling back to local SQLite.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Resident | `resident@wardlens.com` | `ChangeMe_Resident_123!` (from `.env.example`) |
| Officer | `officer@wardlens.com` | `Officer123!` |
| Oversight | `oversight@wardlens.com` | `Oversight123!` |
| Administrator | `admin@wardlens.com` | `ChangeMe_Admin_123!` (from `.env.example`) |

These accounts are for local development only. The API does not print credentials at startup. Production starts with only the administrator configured through the hosting provider's `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables; it does not create the local resident, officer, or oversight demo accounts. Users can create resident accounts through the registration page. Seed users are inserted only if their emails do not already exist, so changing an environment password does not change an existing database user's password.

## Deploy frontend to Vercel and API to Render with Turso

The frontend is a static Vite application and can be deployed to Vercel. The Express API uses Turso's hosted libSQL database in production, so it does not depend on a local file that can disappear on serverless hosts. Turso is SQLite-compatible and relational; the app keeps its existing relational schema and SQL API. This repository includes [`render.yaml`](./render.yaml) for the API host environment.

1. Create a Turso database and generate an authentication token using the [Turso dashboard or CLI](https://docs.turso.tech/). Copy the database URL (usually starts with `libsql://`) and token; keep the token private.
2. In Render, create a **Blueprint** from this repository and apply `render.yaml`. Set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `ADMIN_EMAIL`, and `CORS_ORIGIN` in the service environment. Set the CORS value to the exact Vercel website origin, such as `https://wardlens.vercel.app` (no trailing slash). Render generates `JWT_SECRET` and `ADMIN_PASSWORD`; retrieve the generated administrator password from the Render environment settings and store it securely.
3. Wait for the API service to deploy. The API initializes the Turso schema and sample records before listening. Verify its health endpoint at `https://<your-api-service>.onrender.com/api/health`; it should return JSON with `"status":"ok"`.
4. Import the repository into Vercel. Set the project root to the repository root and add the environment variable `VITE_API_URL` with the API's full URL, including `/api`, for example `https://<your-api-service>.onrender.com/api`.
5. Deploy or redeploy the Vercel project after setting `VITE_API_URL`; Vite embeds this value at build time. In Render, keep `CORS_ORIGIN` set to the exact deployed Vercel origin. Add a custom domain or preview origin to that comma-separated allowlist if you use one, then redeploy the API.
6. Test registration/sign-in, project and ward lists, project details, and a write action such as contact submission. Browser API requests should go to the Render URL, not `localhost` or the Vercel static site.

To preserve existing local records, create a **fresh, empty** Turso database and run the importer before starting the API against it. It copies wards, users, projects, votes, milestones, feedback, budget records, contact messages, and audit logs while preserving IDs. The importer refuses to write if any destination table already contains data and performs the transfer transactionally. It uses the supplied admin credentials for the migrated default administrator and invalidates the built-in resident/officer/oversight demo passwords so the published local demo credentials cannot sign in to production.

PowerShell:

```powershell
$env:DATABASE_PATH = ".\data\wardlens.sqlite"
$env:TURSO_DATABASE_URL = "libsql://your-database-your-org.turso.io"
$env:TURSO_AUTH_TOKEN = "your-private-token"
$env:ADMIN_EMAIL = "admin@your-domain.example"
$env:ADMIN_PASSWORD = "a-new-unique-admin-password"
npm run db:import:turso
```

For macOS/Linux, prefix the command with `DATABASE_PATH=... TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=...`. Keep the token private and do not commit it. After the import completes, configure the same Turso URL/token in Render and deploy the API. If you skip importing, Turso starts with seeded example records. Keep `JWT_SECRET`, `ADMIN_PASSWORD`, `TURSO_AUTH_TOKEN`, and database contents private. Do not use local development passwords in production. Configure Turso backups and review its access controls for your deployment.

## Production build and PWA preview

```bash
npm run build
npm run pwa
```

Open `http://localhost:4173`. The service worker registers in production builds. For full functionality, run the API separately or configure the hosting setup to serve the API at the URL specified by `VITE_API_URL`.

## Environment variables

| Variable | Purpose | Local default |
|---|---|---|
| `PORT` | API port | `4000` |
| `NODE_ENV` | Runtime environment | `development` |
| `JWT_SECRET` | JWT signing secret | Development placeholder in code if unset; replace it |
| `JWT_EXPIRES_IN` | Session lifetime | `12h` |
| `CORS_ORIGIN` | Comma-separated frontend origins allowed by API | `http://localhost:5173` |
| `VITE_API_URL` | API base URL used by Vite frontend; set to the hosted API URL when deploying the frontend separately | `http://localhost:4000/api` |
| `DATABASE_PATH` | Local SQLite database path; ignored when Turso is configured | `./data/wardlens.sqlite` |
| `TURSO_DATABASE_URL` | Hosted Turso/libSQL database URL; configure together with the auth token | unset (uses local SQLite) |
| `TURSO_AUTH_TOKEN` | Secret token used to connect to the hosted Turso database | unset (uses local SQLite) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seed admin credentials | See `.env.example` |
| `RESIDENT_EMAIL` / `RESIDENT_PASSWORD` | Seed resident credentials | See `.env.example` |

`VITE_API_URL` is a build-time frontend variable. Rebuild after changing it. Keep `.env` out of source control.

## Project structure

```text
wardlens/
  public/                 PWA manifest, service worker, SVG logo and favicon
  server/
    db.js                 Turso/SQLite adapters, schema, seed data, audit helpers
    index.js              Express API, authentication, validation and route handlers
    import-sqlite-to-turso.js  One-time local data import utility
  scripts/
    dev.js                Starts API + Vite and shuts both down together
  src/
    components/
      shared/common/      Header, footer and shared layout
      shared/ui/          Status, progress, loading, notices, error boundary and route guards
      projects/           Reusable project card
      wards/              Reusable ward card
    hooks/                Auth provider and data-fetch hook
    pages/                Home, project, ward, budget, participation, auth and admin pages
    utils/                API client, formatters and paths
    App.tsx               Route configuration
    index.css             Sky-blue/white design system and responsive styles
    types.ts              Shared frontend types
  tests/                  API integration tests
  API.md                  Endpoint reference
```

## Test and build

```bash
npm test
npm run build
```

The integration test runs against an isolated temporary SQLite database and checks API health, login, project listing, authenticated proposal submission, unique voting, role permissions, contact inbox persistence, and financial-record transactions.

## Important production hardening still required

This is a functional MVP starter, not a government-certified or independently audited system. Before a real public launch:

- Replace demo data and validate the official ward/project/budget source data.
- Set strong environment secrets, HTTPS, secure hosting, rate limits, request logging, backups, and monitoring.
- Review identity and resident-voting eligibility policies with the responsible authority. The included voting rule is one account per proposal, not national identity verification.
- Add managed object storage and malware scanning for real evidence uploads; the MVP accepts evidence URLs only.
- Add deployment-managed sessions or short-lived access tokens with refresh/rotation as appropriate, account recovery, email verification, CSRF protection if cookies are introduced, and stronger abuse controls.
- Review privacy, retention, public access, accessibility, and official financial disclosure requirements.
- Run security, performance, accessibility, and recovery tests against the chosen deployment environment.

## Data integrity notes

Financial figures show what was entered in WardLens, not independently verified spending. The system records audit entries for important actions, but an audit log is not a tamper-proof external ledger. Public status is a reported status. Users should consult the accountable public office for source documents and formal decisions.
