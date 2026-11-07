# SpaceB&E

A first-person space-mission game for the browser, built by 4 people in 48 hours. With $5,000,000, you design your own rocket, launch from Earth, land on Mars, walk the surface in a spacesuit, uncover what happened to the lost crew of Halcyon-1, and try to come home.

The full spec is in [`docs/TEAM_PROMPT.md`](docs/TEAM_PROMPT.md). This README only covers who does what. If the two disagree, the spec wins.

**Stack:** Vite, Three.js, vanilla JavaScript ES modules, HTML/CSS overlays.

## Roles

| Role | Owner | Branch | Folders |
|---|---|---|---|
| 1. Rocket Builder + Core Keeper | Quoc Thai Nguyen ([@Myklede](https://github.com/Myklede)) | `role1-builder` | `src/core/`, `src/builder/` |
| 2. Flight & Astronaut | Minh Vuong ([@laibaminhvuong-ux](https://github.com/laibaminhvuong-ux)) | `role2-flight` | `src/flight/`, `src/surface/` |
| 3. Graphics & Audio | dtri ([@dtri2206](https://github.com/dtri2206)) | `role3-graphics` | `src/graphics/`, `src/audio/`, `src/ui/` |
| 4. Story, Cruise & Knowledge | Le Quoc Viet Pham ([@quocviet1207](https://github.com/quocviet1207)) | `role4-story` | `src/cruise/`, `src/story/`, `src/missions/`, `src/guidebook/`, `src/report/` |

Models, textures and audio go in `public/assets/`, and everything used is credited in `CREDITS.md`.

### Role 1: Rocket Builder + Core Keeper

- **Builds:** hangar computer UI, LEGO-style builder, engine workbench, Formula Lens, Go/No-Go poll, economy, save, preset ships, debug panel.
- **Also:** sets up the Vite project, keeps `src/core/`, and checks that `dev` still boots at every checkpoint.
- **Start with:** basic parts and snapping, text Go/No-Go, economy and failure penalty, the "Reliable" preset, debug mode.
- **Delivers by hour 3:** `ShipSpec` and 3 preset JSONs in `src/core/mocks/`, economy API, debug panel, `builder:highlightPart`.
- **Needs:** theme CSS (Role 3), guidebook text (Role 4).

### Role 2: Flight & Astronaut

- **Builds:** flight controller (physics and cockpit controls), Flight Assist, launch/orbit scene, entry/landing scene, Max-Q and G meters, first-person walking (ship interior and Mars EVA), interactable system, stations, airlock, suit, oxygen.
- **Start with:** launch to orbit, entry to landing, interior with seat, suit, airlock and O₂ station, EVA with oxygen.
- **Delivers by hour 3:** `FlightController`, `registerInteractable({id, position, prompt, onUse})`, `flight:*` and `eva:*` events.
- **Needs:** `ShipSpec` (mock is fine), `getTerrainHeight` and models by name (Role 3).

### Role 3: Graphics & Audio

- **Builds:** renderer and post-processing, skybox, Earth and Mars with atmosphere shaders, cockpit, cabin and Mars visuals, VFX (flame, plasma, dust), HUD theme, cinematic API, all sound, Low/High quality settings.
- **Start with:** placeholder assets behind names so everyone else can run, then a visual sandbox page.
- **Delivers by hour 3:** `graphics.init()`, `assets.get(name)`, `getTerrainHeight(x, z)`, `cinematic.play(...)`, `audio.play(id)`, theme CSS.
- **Needs:** nothing blocking.

### Role 4: Story, Cruise & Knowledge

- **Builds:** cruise scene (map, time-warp, day counter, launch window, solar storm, malfunction, family messages), story and Halcyon-1 logs, Mars tasks and progress, ending screens and sequences, black box and Flight Report, Guidebook, all narrative and educational text, demo script.
- **Start with:** cruise map with 1 encounter, 1 task of each type, 1 ending screen.
- **Delivers by hour 3:** text JSONs (tips, Go/No-Go lines, analogies), task placement data, `guidebook:open`, a mock black-box report.
- **Needs:** `registerInteractable` and `FlightController` (Role 2), `cinematic.play` (Role 3).

### Parts the spec leaves unassigned

Proposed owners, to confirm at the contract freeze:

| Part | Owner | Why |
|---|---|---|
| Main menu, content warning, Esc menu, settings | Role 1 | The save system already stores settings |
| Pre-launch screen (family photo, message home) | Role 4 | The Adrift ending plays them back |
| Return and first-step cinematics | Role 4 | Same setup as the endings, using Role 3's cinematic API |

## Working rules

1. Stay inside your own folders. Talk to other roles only through events and public APIs (spec §14).
2. Work on your role's branch and merge into `dev` when a piece is finished. Keep `dev` running: `npm run dev` starts the game with no console errors.
3. Make every feature testable alone through `?debug=1`, using mocks until the real data arrives.
4. Keep text, numbers, parts and task placement in JSON, so balancing doesn't cause merge conflicts.
5. After the contract freeze, contracts change only if all four people agree.
6. When the spec is unclear, pick the simplest option and write it in `docs/DECISIONS.md`.

## Getting work to `main`

1. Merge your finished work into `dev` and push it.
2. Tell the team, and everyone checks `dev`.
3. When everyone agrees, dtri moves `dev` to `main`. Nobody else pushes to `main`.

## Timeline

| Hours | Goal |
|---|---|
| 0–3 | Contract freeze: repo setup, `src/core/` contracts, mocks, debug panel, stubs of every public API |
| 3–18 | Each role builds its Tier 0 parts alone |
| 18–24 | Integration: the full Tier 0 loop is playable |
| 24–36 | Tier 1 "wow" features and graphics polish |
| 36–42 | Balance, bug fixes, performance, Tier 2 if safe |
| 42–45 | Feature freeze, bug fixes only, deploy |
| 45–48 | Record a backup demo video, rehearse the pitch |

Everyone merges finished work into `dev` at hours **12, 18, 24, 30, 36 and 42**, and Role 1 checks that it still boots. When time runs short, cut from the bottom tier up (spec §16).

## Getting started

```bash
git clone https://github.com/dtri2206/SpaceB-E.git
cd SpaceB-E
git switch dev
npm install
git switch -c <your-role-branch>
```

To work with Claude or Codex, paste all of `docs/TEAM_PROMPT.md` as your first message and set the last line to your role number, for example `MY ROLE: 2`.
