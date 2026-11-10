# Mobile app (Expo, from scratch)

Objective: rebuild the Expo app in `mobile/` against the local backend, following the plan and contract in `docs/app/README.md` (decisions, screens, design tokens, backend contract).
Branch: tracker `feat/mobile-app` (from `migration` at `55dfb45`), one chained branch per slice · Delivery strategy: ask-on-risk, chain strategy **feature-branch-chain** (user, 2026-11-10) · Test runner: `npx jest` in `mobile/`, plus `npx tsc --noEmit` and `npx expo lint`.

## Specs

- **S1** — Good practices, planned first: "si rehacer la app con buenas practicas, antes de nada planeemos". Expo Router, TypeScript `strict`, feature folders, container-presentational, atomic design, TanStack Query for server data, Zustand only for session and theme, API types generated from the backend OpenAPI, tests with jest-expo + React Native Testing Library, ESLint + Prettier.
- **S2** — Login only, through Cognito: "solamente login todo el tema de login y demas es con cognito no?" and "fetch directo si". `InitiateAuth` with `USER_PASSWORD_AUTH` by direct `fetch` (no Amplify), `Authorization: Bearer <IdToken>` on every API and agent request, refresh with `REFRESH_TOKEN_AUTH` on a `401` and retry once, sign out if refresh fails, tokens in `expo-secure-store`.
- **S3** — Look inspired by Donkey Republic: "me gusta la estetica de donkey republic" and "si perfecto," (same orange). Accent `#FF6400` only for actions with dark text `#1E1814` on it, cream backgrounds, Geist, radii 8–24 px, light and dark mode. Token values in `docs/app/README.md` § Estética (dark values are a proposal).
- **S4** — Styling: "StyleSheet con tokens, como recomiendas". `StyleSheet` + typed design tokens, no NativeWind.
- **S5** — Screens: "no, me parece bien tenerlo donde esta, la cosa es aprovechar un poco la estructura que teniamos antes, y mejorar la parte de las flashcards en plan que se muestren en un apartado tambien, el tema de resumen en el mismo chat lo veo bien", "dentro de cada proyecto" and "la opcion uno que funciona con la api actual". Projects is the home screen (settings in the header, no drawer); a project has `Chats | Documentos | Flashcards`; summary, flashcards and quiz appear as cards inside the chat; the Flashcards section lives inside each project and works with the current API.
- **S6** — Markdown: "libreria de markdown diria yo ya esta testado" and "si" to `react-native-marked`. Citations `[n]` become buttons showing document and page.
- **S7** — Backend contract exactly as in `docs/app/README.md` § Contrato con el backend: `EXPO_PUBLIC_*` configuration, generic PDF upload (all `fields`, file last), polling of background generations, SSE chat events `token` / `sources` / `artifact` / `end` / `error` read with `expo/fetch`.

## Tasks

| ID | Specs | Task | Route | Status | Evidence |
|----|-------|------|-------|--------|----------|
| T1 | S1, S3, S4 | Tooling (jest-expo, RNTL, ESLint, Prettier), design tokens + theme (light/dark), Geist, base atoms | inline | done | `dc6cfda` (slice 1), slice 2 commit on `feat/mobile-app-02-ui`; RED `Cannot find module './tokens'`/`'./Button'`/`'./TextField'`; GREEN 21 tests, `tsc`, `expo lint`, `prettier --check`, iOS `expo export` bundle |
| T2 | S1, S7 | Env config, generated OpenAPI types, HTTP client with bearer token, TanStack Query provider | inline | done | slice 3 `feat/mobile-app-03-api`; RED `Cannot find module './env'`/`'./client'`, `scripts.export_openapi` import error; GREEN 33 mobile tests, 123 backend unit tests, `tsc`, `expo lint`, `prettier --check`, `ruff` |
| T3 | S2 | Cognito login, token storage, refresh on 401, auth-guarded routes, login screen | inline | pending | |
| T4 | S5 | Projects: list, create, rename, delete | inline | pending | |
| T5 | S5, S7 | Documents: list, upload PDF, processing states | inline | pending | |
| T6 | S5, S6, S7 | Chat: conversations, SSE streaming, Markdown with citations, artifact cards | inline | pending | |
| T7 | S5 | Flashcards section and study mode; quiz and result | inline | pending | |
| T8 | S5 | Settings: name, theme, sign out | inline | pending | |

Route evidence: no Writer trigger (tasks depend on each other and share the skeleton), so the parent works inline.

## Log

- **L1** (2026-11-10) — User: "dale el commit y emepcemos con la parte mobile". Plan agreed in this session and written in `docs/app/README.md` (`47aa31a`); repository cleaned and blank Expo SDK 58 app scaffolded (`55dfb45`). Native review offered for both commits (assessed high: deleted old auth code and an executable script); user chose "Omitir esta vez".
- **L2** (2026-11-10) — Delivery: T1 reached 620 authored lines, so the user chose "Cadena de ramas" (feature-branch-chain). Slices: `feat/mobile-app-01-theme` (tooling, tokens, theme, Geist; 16 tests) and `feat/mobile-app-02-ui` (atoms `AppText`, `Button`, `TextField`, `Card`, `Screen` + placeholder home; 270 lines). Contrast is pinned by tests: every text/background pair ≥ 4.5:1 in both schemes. Findings: TypeScript 6 needs `"types": ["jest"]`; React Native 0.88 no longer exports `StyleSheet.NamedStyles`; RNTL 14 `render` is async; Prettier must skip `assets/` (it rewrote `expo.icon/icon.json`). Native review: slice 1 assessed medium, `under_budget`. Push and PRs (tracker draft PR + chained children) are the user's call.
- **L3** (2026-11-10) — T2: `backend/scripts/export_openapi.py` writes the schema without any backing service (routes only touch the container per request); `npm run api:types` regenerates `src/shared/api/openapi.json` + `schema.d.ts`. `openapi-typescript` 7.13 requires TypeScript 5 while SDK 58 ships TypeScript 6, so it runs through a pinned `npx` instead of being a dependency. The API client already implements the 401 → refresh once → retry rule (S2) behind `onUnauthorized`; T3 wires it to Cognito. Mutations never retry; queries retry server and network errors twice, never 4xx.
