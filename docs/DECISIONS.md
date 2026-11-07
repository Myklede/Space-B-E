# Decisions

Choices the spec left open. Add a line whenever you pick the simplest option: the date, your role, the decision and why.

- **Branches:** finished work goes to `dev`, and only dtri moves `dev` to `main`, once the whole team has checked it. Nobody else pushes to `main`.
- **Pre-push hook:** `npm install` adds a hook on each person's machine. It runs `npm run check` before a push to `dev` and refuses pushes to `main`, because GitHub can't protect branches on this plan.
- **`src/core/` belongs to Role 3 (dtri),** by the team lead's decision. Requests to change it go through dtri. `src/core/balance.json` is open to everyone.
- **Main menu, content warning, Esc menu and settings are Role 1's,** built in `src/builder/`. Core holds plumbing only, with no game screens.
- **Pre-launch screen and the return and first-step cinematics are Role 4's,** because they tie into the story and the Adrift ending.
- **`ShipSpec` gaps:** `parts` have `x, y, z` so radial symmetry can be expressed, nozzles are only `sl` or `vac`, and `launch: { tempC }` carries the weather for the Cold Morning ending. See `src/core/contract.js`.
- **`flight:telemetry`** was added so the black box can record peak values, and `builder:highlightPart` was added to the event list.
- **2026-11-07, Role 1: Δv per leg in `balance.json` scaled to the 1/10 world.** Speeds scale with √(gR), so transfer and return are the real values ÷ √10: transfer 2.1 → 1.2 km/s, return 3.1 → 2.0 km/s; ascent stays 3.3 (Role 2's gravity turn costs 3.3–4.1 in the sim) and landing 0.4. With the old numbers no single-stage ship could reach Mars (Role 2's own test ship reaches orbit with 952 m/s left). Still provisional; Role 2 please confirm against the sim.
- **2026-11-07, Role 1: insolvency.** `balance.insolvencyFloor` ($1.0M, about the cheapest ship that can leave the pad). When funds are below it the hangar shows "DECLARE BANKRUPTCY", which emits `ending:show { endingId: 'bankrupt' }` and requests `ENDING`. Role 4: on that ending please reset money even though it is still above $0 (the contract's "money < 0" alone would leave the player stuck forever).
- **2026-11-07, Role 1: launch windows.** The player picks a launch slot in the hangar (`src/builder/data/launch.json`): the soonest is free and cold (2 °C, the Challenger setup), later ones cost pad fees. The fee is charged with the ship at confirm and counts for `OVER_BUDGET`; `ShipSpec.launch.tempC` carries the slot's temperature.
- **2026-11-07, Role 1: cheap seals are a discount part** (−$100k, reliability 0.85, `coldRatedSeals: false`), not a required choice: tanks come cold-rated unless the player takes the money.
- **2026-11-07, Role 1: builder data shapes.** The rocket is an attachment tree (`src/builder/README-ARCH.md`); parts and all text live in `src/builder/data/*.json`; the ShipSpec adds `stats.ascentCdA` and `stats.cdA` for Role 2. Money is spent only at the Go/No-Go confirm. Legs attach to the engine's radial node so the feet reach the ground.
- **2026-11-07, Role 1: `src/builder/index.js` also exports `openPauseMenu()` and `openSettings()`** so other roles can open the Esc menu and settings from their states. Settings keys in the save: `sensitivity`, `invertY`, `quality`, `volume`, `skipSensitive`.
- **2026-11-07, Role 1: Vite 8 needs Node 20.19+ or 22.12+.** Node 21 fails before `vite` starts (`util.styleText`). dtri: consider adding `"engines": { "node": ">=22.12" }` to `package.json` and a line in the README.
