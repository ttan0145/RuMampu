# RuMampu frontend

Language: **English** | [Chinese (CN)](README.cn.md)

Expo + React Native + TypeScript client with English, Bahasa Melayu, and Chinese localisation. The screens originated in the early design prototype and are being connected to the production Django API one domain at a time. English is the default application language.

## Start

```powershell
npm ci
Copy-Item .env.example .env
npm start
```

Formal development defaults to connected API mode. `EXPO_PUBLIC_APP_MODE` should remain `api`, and `EXPO_PUBLIC_API_URL` should point to the versioned API, for example:

```text
EXPO_PUBLIC_APP_MODE=api
EXPO_PUBLIC_API_URL=http://localhost:8000/api/v1
```

Expo Web and Django should use the same hostname so that `credentials: include` can persist the guest-session cookie. A missing API URL uses the local API fallback and therefore fails visibly if the backend is unavailable. In-memory prototype behaviour is available only when `EXPO_PUBLIC_APP_MODE=prototype` is set explicitly; Epic 2 never calculates a client-side substitute in that mode.

## Structure

```text
app/                         Expo Router entry point
src/rumampu/
  api.ts                     Versioned API client and consistent error parsing
  state.tsx                  Application state, navigation, and API synchronisation boundary
  mock.ts                    Prototype data for domains not yet connected
  calc.ts                    Pure calculation functions
  strings.ts                 English, Bahasa Melayu, and Chinese localisation
  theme.ts / ui.tsx          Design tokens and UI primitives
  charts.tsx / svgs.tsx      Charts and graphics
  overlays.tsx               Sheets, onboarding, and global feedback
  screens/                   Domain screens
```

## Development rules

- API data is the source of truth for connected domains and must not be overwritten by mock data.
- Screen components do not construct URLs; all requests go through `api.ts`.
- Flow control uses the API error `code`, never the English fallback `message`.
- Monetary responses are decimal strings. Keep them as strings for display formatting; only presentation-only chart scaling may convert them to numbers.
- Duplicate submissions must be disabled while a save request is in progress; API idempotency is not implemented yet.
- Run `npm run typecheck` before committing.
- Run `npm run test:e2e:epic2` for the backend-connected Epic 2 browser acceptance suite. It applies migrations and starts the local Django and Expo Web servers automatically.

## Running e2e locally during the Expo SDK 57 period

The Metro dev bundle shows a React ARIA warning toast that blocks clicks, so run the specs against a production web export:

1. Export (PowerShell): `$env:EXPO_PUBLIC_E2E='1'; $env:EXPO_PUBLIC_PLAYWRIGHT_API_URL='http://localhost:8004/api/v1'; $env:EXPO_NO_DOTENV='1'; $env:CI='1'; npx expo export --platform web --output-dir dist --clear` (the API port must match `PLAYWRIGHT_BACKEND_PORT` below).
2. Run: `$env:PLAYWRIGHT_BACKEND_PORT='8004'; $env:PLAYWRIGHT_FRONTEND_PORT='8085'; $env:PLAYWRIGHT_STATIC_DIR='dist'; npm run test:e2e:static -- e2e/epic5-upfront-fees.spec.ts`. `playwright.static.config.ts` reuses the backend server from `playwright.config.ts` and serves the export with `http.server`. Defaults are ports 8000/8081 and `dist`.
3. Optional switches: `PLAYWRIGHT_REUSE=1` reuses backend/frontend servers you already started with the commands in the config (no restart between runs); `PLAYWRIGHT_TRACE=1` keeps failure traces locally (off by default, always on in CI); `PLAYWRIGHT_SKIP_PRICE_MODEL=1` skips `load_price_model` when the database already has the active model; `PLAYWRIGHT_WORKERS=N` sets the worker count (default 1, each worker needs its own database/ports).

Historical-income import uses `expo-document-picker` to select a UTF-8 CSV and strictly follows the preview/confirm protocol. Income pattern and coverage use typed backend-authoritative responses with explicit retry and confirmation states. See the [API contract](../docs/API_CONTRACT.md). Receipt OCR and Epic 5 screens remain prototype behaviour.
