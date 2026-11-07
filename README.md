# SpaceB&E

A first-person space-mission game for the browser, built by 4 people in 48 hours. With $5,000,000, you design your own rocket, launch from Earth, land on Mars, walk the surface in a spacesuit, uncover what happened to the lost crew of Halcyon-1, and try to come home.

**Stack:** Vite, Three.js, vanilla JavaScript ES modules, HTML/CSS overlays. Keyboard and mouse, desktop browser, UI in English.

## For AI agents: start here

Do these steps in order before writing any code.

1. **Find your role.** Ask your human which role they have, or match `git config user.name` to the table below. Work only on that role.
2. **Read the spec sections listed for your role** in [`docs/TEAM_PROMPT.md`](docs/TEAM_PROMPT.md). Everyone also reads §0, §14 and §15. If the spec and this README disagree, the spec wins.
3. **Check [Status](#status)** to see what already exists. Use what's there, and use a local mock for anything that doesn't exist yet. Never wait for another role.
4. **Set up your branch:**
   ```bash
   git switch dev && git pull
   npm install
   git switch -c <your-role-branch>   # or: git switch <your-role-branch> && git merge dev
   npm run dev
   ```
5. **Do your role's next tasks**, in order, inside your own folders.
6. **When a piece works,** follow [Getting work to `main`](#getting-work-to-main) and update your row in [Status](#status).

Before you start, tell your human in a few lines which role you took, what you will build first, and what you need from other roles.

### Rules that always apply

- **Never push to `main`.** Finished work goes to `dev`.
- **Edit only your own folders.** Talk to other roles only through events and public APIs (spec §14), and never import another role's internal files. If you need a change in someone else's area, tell your human.
- **Keep `dev` running:** `npm run dev` starts the game with no console errors.
- **Make every feature testable alone** through `?debug=1` and your sandbox page, `/sandbox/<role>.html`.
- **Keep text, numbers, parts and task placement in JSON,** so balancing doesn't cause merge conflicts.
- **Science must be correct.** Use NASA/ESA values. If unsure, mark it `// TODO verify` and tell your human.
- **When the spec is unclear,** pick the simplest option and write it in `docs/DECISIONS.md`.
- **After the contract freeze (hour 3),** contracts change only if all four people agree.
- **A demo that runs smoothly and looks beautiful beats complex mechanics that don't work.** When time runs short, cut from the bottom tier up (spec §16).

## Roles

| Role | Owner | Branch | Your folders | Spec sections |
|---|---|---|---|---|
| 1. Rocket Builder + Core Keeper | Quoc Thai Nguyen ([@Myklede](https://github.com/Myklede)) | `role1-builder` | `src/core/`, `src/builder/` | §3, §5, §8 |
| 2. Flight & Astronaut | Minh Vuong ([@laibaminhvuong-ux](https://github.com/laibaminhvuong-ux)) | `role2-flight` | `src/flight/`, `src/surface/` | §4, §6, §7 |
| 3. Graphics & Audio | dtri ([@dtri2206](https://github.com/dtri2206)) | `role3-graphics` | `src/graphics/`, `src/audio/`, `src/ui/` | §12 |
| 4. Story, Cruise & Knowledge | Le Quoc Viet Pham ([@quocviet1207](https://github.com/quocviet1207)) | `role4-story` | `src/cruise/`, `src/story/`, `src/missions/`, `src/guidebook/`, `src/report/` | §2, §6.3, §8, §9, §10, §11, §13 |

Models, textures and audio go in `public/assets/`, and everything used is credited in `CREDITS.md`.

### Role 1: Rocket Builder + Core Keeper

**You build:** hangar computer UI, LEGO-style builder, engine workbench, Formula Lens, Go/No-Go poll, economy, save, preset ships, debug panel. You also keep `src/core/` and check that `dev` boots at every checkpoint.

**Next tasks:**
1. Add `index.html` and `src/core/`: `main.js` boot, `state.js`, `events.js`, `planets.js` (exact contents in §14), `save.js`, debug panel at `?debug=1`. `package.json` already exists, so extend it rather than replacing it.
2. Add `ShipSpec` with 3 preset JSONs in `src/core/mocks/`, the economy API and `builder:highlightPart`. The other roles are waiting for these.
3. Tier 0: basic parts and snapping, text Go/No-Go, economy and failure penalty, the "Reliable" preset.

**You use:** theme CSS (Role 3), guidebook text (Role 4), `assets.get('rocketPart:<id>')` (Role 3).

### Role 2: Flight & Astronaut

**You build:** flight controller (physics and cockpit controls), Flight Assist, launch/orbit scene, entry/landing scene, Max-Q and G meters, first-person walking (ship interior and Mars EVA), interactable system, stations, airlock, suit, oxygen.

**Next tasks:**
1. Add stubs of `FlightController`, `registerInteractable({id, position, prompt, onUse})`, and the `flight:*` and `eva:*` events. Role 4 is waiting for these.
2. Tier 0: launch to orbit, entry to landing, interior with seat, suit, airlock and O₂ station, EVA with oxygen.

**You use:** `ShipSpec` (mock it until Role 1 delivers), and from Role 3 `getTerrainHeight`, `createMarsScene`, `createSpaceScene`, `assets.get('cockpit')` and `assets.get('cabin')`.

### Role 3: Graphics & Audio

**You build:** renderer and post-processing, skybox, Earth and Mars with atmosphere shaders, cockpit, cabin and Mars visuals, VFX (flame, plasma, dust), HUD theme, cinematic API, all sound, Low/High quality settings.

**Next tasks:**
1. Real Earth and Mars textures, with credits.
2. Art pass on the rocket parts and mission props, then real audio.
3. Measure frame rate on a mid-range laptop.

**You use:** nothing blocking. Work in `/sandbox/role3.html`.

### Role 4: Story, Cruise & Knowledge

**You build:** cruise scene (map, time-warp, day counter, launch window, solar storm, malfunction, family messages), story and Halcyon-1 logs, Mars tasks and progress, ending screens and sequences, black box and Flight Report, Guidebook, all narrative and educational text, demo script.

**Next tasks:**
1. Add text JSONs (tips, Go/No-Go lines, Formula Lens analogies), task placement data, `guidebook:open` and a mock black-box report. Role 1 is waiting for the text.
2. Tier 0: cruise map with 1 encounter, 1 task of each type, 1 ending screen.

**You use:** `registerInteractable` and `FlightController` (mock them until Role 2 delivers), `cinematic.play`, `audio.play` and mission props from `assets.get` (Role 3).

### Parts the spec leaves unassigned

| Part | Owner |
|---|---|
| Main menu, content warning, Esc menu, settings | Role 1 |
| Pre-launch screen (family photo, message home) | Role 4 |
| Return and first-step cinematics | Role 4, using Role 3's cinematic API |

## Status

Update your row whenever you push to `dev`.

| Role | On `dev` now |
|---|---|
| 1 | Nothing yet. `index.html` and `src/core/` don't exist, so `/` shows a 404 and `npm run build` fails. |
| 2 | Nothing yet |
| 3 | All hour-3 APIs below. See every view at `/sandbox/role3.html`. Art is generated in code. The cabin is a full art pass and the VFX exist; parts, props and sounds are still placeholders. |
| 4 | Nothing yet |

## Role 3 APIs you can use now

```js
import { graphics, assets, getTerrainHeight, cinematic, createMarsScene, createSpaceScene } from '/src/graphics/index.js';
import { audio } from '/src/audio/index.js';
import '/src/ui/theme.css';

graphics.init({ container, quality: 'high' });   // 'low' or 'high'
const { scene } = createMarsScene();             // sky, ground, rocks, dust, fog, light
graphics.setView(scene, camera);

function frame(dt) {                             // your game loop
  graphics.render(dt);                           // seconds since the last frame
}
```

Units are metres and +Y is up.

| API | What it gives you |
|---|---|
| `getTerrainHeight(x, z)` | Mars ground height. The landing site is at the origin, and walking is accurate within ±900 m. |
| `createMarsScene({ sunElevation, sunAzimuth })` | `{ scene, sun, setSunElevation(degrees, azimuth) }` |
| `createSpaceScene()` | A scene with stars, Milky Way and Sun. Add planets yourself. |
| `graphics.setSunDirection(vector)` | The direction towards the Sun, for planets and the space sky |
| `graphics.setEffects({ vignette, blackout, shake })` | Screen effects from 0 to 1, for g-force and low O₂ |
| `graphics.fade({ to, duration, color })` | Fades the screen and returns a Promise |
| `cinematic.play({ camera, cameraPath, duration, fades, onUpdate })` | Scripted camera move that returns a Promise. `cameraPath` is `[{ position: [x, y, z], lookAt: [x, y, z] }, ...]` and `fades` is `[{ at, to, duration, color }]`. Leave the camera alone while `cinematic.active` is true. |
| `audio.play(id, { volume, loop, rate })`, `audio.stop(id)` | Sounds. `audio.ids()` lists them. |
| `audio.setAir(0..1)` | Thins engine sound with altitude: 1 at sea level, 0 in vacuum |

**`assets.get(name)`** always returns an `Object3D`, and a new one on each call. A name with no art yet shows a hologram and logs a warning.

| Name | Notes |
|---|---|
| `cockpit` | The origin is the pilot's eye and forward is -Z. `userData.setAlarm(true)` turns on the red alarm. |
| `cabin` | 4 × 8 m, with the origin at the middle of the floor. `userData.stations` holds positions for `pilotSeat`, `o2Station`, `suitLocker`, `commsConsole`, `sampleStorage`, `airlock` and `bunk`. `userData.props` holds `foodRack`, `waterRecycler`, `exerciseBike` and `familyPhoto`. `userData.setAlarm(true)` dims the lights and pulses a red one. |
| `vfx:engineFlame` | Origin at the nozzle exit, plume down -Y, built for a 0.95 m nozzle (scale it for others). `userData.set({ throttle: 0..1, airDensity: 0..1, fuel: 'kerolox' \| 'methalox' \| 'hydrolox' })`. Sea-level plume has shock diamonds, vacuum balloons wider and fainter. Carries a point light. |
| `vfx:exhaust` | Origin at the nozzle exit, smoke falls down -Y. `userData.set({ throttle: 0..1, airDensity: 0..1 })`. Invisible in vacuum. |
| `vfx:entryPlasma` | Add it to the cockpit group (its coordinates). `userData.set({ intensity: 0..1 })`. Streaks outside the window, and an orange light inside. |
| `vfx:landingDust` | Origin on the ground under the engine, +Y up. `userData.set({ intensity: 0..1 })`. A sheet of dust up to about 40 m wide. |
| `planet:earth`, `planet:mars` | Radius 1, so set `planet.scale.setScalar(radius)`. To spin it, rotate `userData.surface`, not the group. |
| `rocketPart:<id>` | The look comes from words in the id: `capsule`, `tank`, `engine`, `nose`, `fin`, `leg`, `heat`. Size comes from `_s`, `_m` or `_l`. `userData.height` is the stacking height. |
| `lander`, `halcyonLander` | Your ship and the lost crew's wreck |
| `scanPoint`, `sampleRock`, `discoveryRock`, `solarPanel`, `iceDeposit`, `dataLog` | Mission props, holograms for now |

**HUD classes:** `.hud`, `.hud-panel`, `.hud-label`, `.hud-value`, `.hud-bar` (set `--value` from 0 to 1), `.hud-button`, and the states `.hud-ok`, `.hud-good`, `.hud-caution`, `.hud-alert`.

**Keep the camera near the origin in space scenes, and move the planets instead.** At 640,000 m from the origin, a 32-bit position is only good to about 6 cm, and the cockpit would visibly shake.

## Known gaps in the spec

These are not decided yet. If your work touches one, raise it with your human instead of guessing.

- **Economy (Role 1):** with the cheapest viable ship at $2.5–3M (§5.6), one failure leaves $1.15–1.75M. That can't pay for another ship, but it stays above $0, so the Bankrupt ending never fires. Surviving 2 failures needs a ship of about $1.3M or less.
- **Δv (Roles 1, 2):** there is no table of the Δv each leg needs in the 1/10-scale world, though the Δv budget, Go/No-Go and the return all depend on it. A rough estimate for the round trip is 8.9 km/s, about 92% fuel by mass on one stage, while staging is Tier 3 and Mars refuelling is Tier 2.
- **`ShipSpec` (Roles 1, 2, 3):** `parts` has only `x, y`, which can't describe radial symmetry in 3D, and `nozzle: 'mid'` has no stats in §5.2.
- **Events (all roles):** nothing carries the weather that the Cold Morning ending needs, no event streams the continuous telemetry the black box needs (peak g, radiation, temperatures), and `builder:highlightPart` isn't in the §14 list.

## Getting work to `main`

1. Merge your finished work into `dev` and push it.
2. Tell your human. They ask the team to check `dev`.
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

Everyone merges finished work into `dev` at hours **12, 18, 24, 30, 36 and 42**, and Role 1 checks that it still boots.
