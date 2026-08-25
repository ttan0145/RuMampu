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

Historical-income import uses `expo-document-picker` to select a UTF-8 CSV and strictly follows the preview/confirm protocol. Income pattern and coverage use typed backend-authoritative responses with explicit retry and confirmation states. See the [API contract](../docs/API_CONTRACT.md). Receipt OCR and Epic 5 screens remain prototype behaviour.
