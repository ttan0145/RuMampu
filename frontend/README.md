# RuMampu — frontend

Expo (React Native + TypeScript) port of the `rumampu18.html` design prototype. The UI, copy
(EN / BM / 中文), charts, and affordability math are a 1:1 translation of the prototype.

## Run

```bash
npm install
npx expo start        # then press i (iOS simulator), a (Android), or w (web)
```

## Structure

```
app/                     expo-router entry (loads fonts, mounts the app)
src/rumampu/
  theme.ts               design tokens (colors, type scale) — mirrors the prototype's CSS variables
  strings.ts             all user-facing copy in 3 languages (verbatim from the prototype)
  mock.ts                seed data + data types — REPLACE THIS with API data when the backend lands
  calc.ts                pure derived calculations (months aggregation, instalment, test rows, …)
  state.tsx              central app state, navigation (route + stack + tabs), i18n helper, toast
  ui.tsx                 primitives (buttons, chips, cards, fields, provenance chips, …)
  charts.tsx             waterline chart, coverage strip, donut, limit bars, range band
  svgs.tsx               logo, onboarding hero illustrations, row icons
  overlays.tsx           bottom sheets, onboarding, splash, toast, tab bar
  screens/               one file per tab group (home, money, expenses, test, prepare)
```

## Backend integration notes

- All data lives in the state provider (`state.tsx`), seeded from `mock.ts`. Swapping
  `initialState()`'s `data: MOCK` for fetched data (and persisting mutations) is the
  integration seam — screens and calculations only read from `S.data`.
- Amount/date fields are plain text inputs (`YYYY-MM-DD`); swap in a native date picker
  (`@react-native-community/datetimepicker`) if wanted.
- The receipt scan is a preview: it fakes OCR with a 1.4s delay and a sample result,
  matching the prototype.
