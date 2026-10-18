# ParkEasy Admin (Vite + React + TypeScript)

Admin control room for ParkEasy: dashboard, users, scouts, leads, bays, bookings, payments, payouts, KYC / risk, devices, live Mapbox map, notifications, support inbox, integrations (Slack, Zoom, HubSpot, Salesforce) and settings. Login and logout are built in.

## Brand
Emerald `#00E5A8` (accent, buttons, map pins, logo) · Midnight Black `#09090B` (dark surfaces) · White `#FFFFFF` (text, light mode). Bebas Neue for logo, page titles and KPI numbers, Inter for body. Tagline: FIND • EARN • PARK. All tokens live at the top of `src/styles.css`.

## Quick start
```bash
npm install
cp .env.example .env      # leave VITE_API_URL empty to run on demo data
npm run dev               # http://localhost:5173  (demo login: admin@parkeasy.co.za / admin123)
```

## Environment
| Variable | Purpose |
|---|---|
| `VITE_API_URL` | ParkEasy admin Edge Function URL. Empty = built-in mock data |
| `VITE_SUPABASE_ANON_KEY` | Public/publishable key for the Supabase project hosting the Edge Function; never use a service-role key in the browser |\n| `VITE_USE_MOCK` | `true` forces mock data even when an API URL is set |
| `VITE_MAPBOX_TOKEN` | Public Mapbox token (`pk.…`) for the Live Map |

## Architecture
```
src/lib/api.ts        fetch layer (Supabase Edge Function, bearer token, 401 -> auto logout, mock fallback)\nsupabase/functions/admin-api/index.ts  server-side admin role checks and test-project data mapping
src/lib/resources.ts  one config per table: columns + row actions (add a resource here)
src/lib/mock.ts       demo data     src/lib/stats.ts  dashboard maths
src/auth/             AuthContext (login, logout, session restore)
src/pages/            Dashboard, ResourcePage, Kyc, LiveMap, Notifications, Integrations, Settings, Login
src/components/       Layout (sidebar + logout), DataTable, useResource
```

### API contract your backend should expose
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | `{email,password}` -> `{token,user:{id,name,email,role}}` (role `admin` or `support`) |
| GET | `/auth/me` | current user |
| GET | `/admin/{users,scouts,leads,bays,bookings,payments,payouts,devices,notifications,support,kyc}` | arrays of rows (see `mock.ts` for fields) |
| PATCH | `/admin/:resource/:id` | `{action}` e.g. `approve`, `reject`, `suspend`, `refund`, `release`, `verify`, `flag` |
| POST | `/admin/announcements` | `{message}` |
| GET / PUT | `/admin/integrations`, `/admin/integrations/:id` | `{connected, config}` |

Bays need `lat` and `lng` for the map. Bookings need an ISO `date`. Every endpoint must enforce admin authorisation server-side; the UI check is only a convenience.

## Tests
```bash
npm run dev            # terminal 1 (mock data)
npm run test:e2e       # Playwright (desktop + mobile)
npm run test:bdd       # Cucumber + Playwright (features in tests/features)
npx playwright install chromium   # first time only
```

## Deploy
- **Vercel:** import the repo (`vercel.json` is included), set the three env vars, push to `main`.
- **CI/CD:** `.github/workflows/ci.yml` runs build + both suites, then deploys on `main`. Add secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.
- **Docker/static:** `npm run build` and serve `dist/` with SPA fallback to `index.html`.

## Dropping into the real ParkEasy project
1. Copy `src/` (or mount it under `/admin`) and merge `package.json` deps.
2. Replace the `MOCK` branches in `api.ts` with nothing; the real calls already exist.
3. Map your real field names in `resources.ts` columns and `mock.ts` shapes.
4. Move the token from `localStorage` to an httpOnly cookie if your API supports it.

## Ready for market checklist
- [x] Local setup, build and typecheck pass (`npm run build`)
- [ ] Playwright and Cucumber suites run green on your machine (written, not yet run)
- [ ] Real API wired and role checks enforced server-side
- [ ] Mapbox token restricted to your domain; Vercel env vars set
- [ ] Integrations: add server-side OAuth/webhook handlers for Slack, Zoom, HubSpot, Salesforce
- [ ] Next sprint: code-split routes (bundle is ~2.5 MB because of mapbox-gl), audit log, pagination and server-side search, KYC document viewer
