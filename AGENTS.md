# AGENTS.md — ¿Quién Quiere Gobernar Uruguay?

## Stack
- React 19 + Vite 8 + TypeScript (noEmit) + Tailwind 4, served by `tsx server.ts` (Express + WebSocket).
- Single app, no monorepo. Entry: `src/main.tsx` → `src/App.tsx`; server: `server.ts`.

## Commands (PowerShell)
PowerShell execution policy blocks `npm.ps1`; use `npm.cmd`.
- Install: `npm.cmd install --legacy-peer-deps` (esbuild peer conflict with Vite 8).
- Dev: `npm.cmd run dev` → http://0.0.0.0:3000
- Typecheck: `npm.cmd run lint` (`tsc --noEmit`)
- Build: `npm.cmd run build` (output `dist/`)
- No test runner configured; verify with `tsc --noEmit` + build.

## Architecture
- `src/types/game.ts` — `GameState v3` (single source of truth).
- `src/engine/*` — pure state mutators (`simulationEngine`, `economyEngine`, `parliamentEngine`, `policyEngine`, `territorialEngine`, `publicEnterprisesAndActorsEngine`, `migrationEngine`, `storageEngine`).
- `src/components/views/*` — read-only React views dispatch typed actions.
- `src/data/*` — calibration, scenarios, policy catalog (~87 policies A–J).
- Persistencia: `localStorage` key `qqgu_saves_v2`; codes `QQGUY1/2/3:`; backup `qqgu_saves_backup_pre_v3`. `normalizeGameState` → `migrateGameState` (v1→v2→v3).

## Conventions / gotchas
- `@/*` alias maps to repo root (`.`), not `src/`.
- Vite HMR can be disabled via `DISABLE_HMR=true` (AI Studio); do not remove.
- `vite.config.ts` build plugin copies `src/assets` into `dist/src/assets`; do not remove.
- `.env*` ignored except `.env.example`; `GEMINI_API_KEY` optional (AI features).
- Topbar relies on `h-[100dvh] overflow-hidden` root container + `sticky top-0` header; keep both.
- Budget allocations are independent (no auto-rebalance to 100%); never re-add rebalancing.
- Policies with `proyecto_ley`/`ley_presupuestal` route to Parliament and must not activate effects until promulgated.
- Vicepresidente votes ordinarily in Senate (31 members, Art. 94); 3/5 venias calculated over 30 elected senators.