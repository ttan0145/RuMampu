# RuMampu frontend

Language: **English** | [Chinese (CN)](README.cn.md)

Expo + React Native + TypeScript client with English, Bahasa Melayu, and Chinese localisation. The screens originated in the early design prototype and are being connected to the production Django API one domain at a time. English is the default application language.

## Start

```powershell
npm ci
Copy-Item .env.example .env
npm start
```

`EXPO_PUBLIC_API_URL` should point to the versioned API, for example:

```text
http://localhost:8000/api/v1
```

Expo Web and Django should use the same hostname so that `credentials: include` can persist the guest-session cookie. If no API URL is configured, the client enters an in-memory prototype mode intended for demonstrations only.

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
- Monetary responses are decimal strings and must be converted explicitly before numeric calculations.
- Duplicate submissions must be disabled while a save request is in progress; API idempotency is not implemented yet.
- Run `npm run typecheck` before committing.

Historical-income import uses `expo-document-picker` to select a UTF-8 CSV and strictly follows the preview/confirm protocol. See the [API contract](../docs/API_CONTRACT.md). Receipt OCR, selected calculations, and Epic 5 screens remain prototype behaviour.
