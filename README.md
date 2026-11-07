# SpaceB&E

A first-person space-mission game for the browser, built by 4 people in 48 hours. With $5,000,000, you design your own rocket, launch from Earth, land on Mars, walk the surface in a spacesuit, uncover what happened to the lost crew of Halcyon-1, and try to come home.

**Stack:** Vite, Three.js, vanilla JavaScript ES modules, HTML/CSS overlays. Keyboard and mouse, desktop browser, UI in English.

**Teammates:** open this repo in Claude Code or Codex and say your role, for example: "My role is 2. Read AGENTS.md and start." Work happens on the `dev` branch.

## For AI agents: start here

Do these steps in order before writing any code.

1. **Find your role.** Ask your human which role they have, or match `git config user.name` to the table below. Work only on that role.
2. **Read the spec sections listed for your role** in [`docs/TEAM_PROMPT.md`](docs/TEAM_PROMPT.md). Everyone also reads §0, §14 and §15, and [`src/core/contract.js`](src/core/contract.js). You don't need the rest of the spec. For names and data shapes, `src/core/contract.js` wins. For everything else the spec wins, then this README.
3. **Read your role's section in [`docs/SHARE_PROBLEMS.md`](docs/SHARE_PROBLEMS.md):** problems other roles found in your folders. Fix open `blocker` and `bug` items first. Then **check [Status](#status)** to see what already exists. Use what's there, and use a local mock for anything that doesn't exist yet. Never wait for another role.
4. **Set up your branch:**
   ```bash
   git switch dev && git pull
   npm install
   git switch -c <your-role-branch>   # first time; later: git switch <your-role-branch> && git merge origin/dev
   npm run dev
   ```
   Node 20.19+ or 22.12+ is required (Vite 8 does not start on Node 21 or older than 20.19).
5. **Do your role's next tasks**, in order, inside your own folders.
6. **Replace the stubs in your own folders** with the real thing, keeping every export listed in `PUBLIC_EXPORTS` in `src/core/contract.js`.
7. **When a piece works,** follow [Getting work to `main`](#getting-work-to-main) and update your row in [Status](#status).

Before you start, tell your human in a few lines which role you took, what you will build first, and what you need from other roles.

### Rules that always apply

- **Never push to `main`.** Finished work goes to `dev`.
- **Edit only your own folders.** Talk to other roles only through events and public APIs (spec §14), and never import another role's internal files. If you find a problem in someone else's area, write it in [`docs/SHARE_PROBLEMS.md`](docs/SHARE_PROBLEMS.md) using the format at the top of that file, and tell your human.
- **Keep `dev` running:** `npm run dev` starts the game with no console errors.
- **`npm run check` must pass before you push to `dev`.** It checks the contract rules and walks the whole game loop in a real browser: `CHROME_PATH` if set (a wrong path fails), else Google Chrome, else Playwright's Chromium (`npx playwright-core install chromium`). With no browser the check fails, never passes. Every state must mount a screen: a real screen sets `data-screen="<STATE>"` on its root element, and then its dev-shortcut stub panel (`data-stub`) can go.
- **Changes to `src/core/`, `index.html`, `scripts/` or npm packages go through dtri (Role 3).** Only `src/core/balance.json` is open to everyone, because balancing numbers is everyone's job.
- **Make every feature testable alone.** `/?debug=1&state=INTERIOR` opens the game directly in any state with a mock ship, plus a debug panel to fire events and set money. If you want a separate test page, create `sandbox/role<N>.html`.
- **Keep text, numbers, parts and task placement in JSON,** so balancing doesn't cause merge conflicts.
- **Science must be correct.** Use NASA/ESA values. If unsure, mark it `// TODO verify` and tell your human.
- **When the spec is unclear,** pick the simplest option and write it in `docs/DECISIONS.md`.
- **After the contract freeze (hour 3),** contracts change only if all four people agree.
- **A demo that runs smoothly and looks beautiful beats complex mechanics that don't work.** When time runs short, cut from the bottom tier up (spec §16).

## How the pieces connect

- **One game loop** lives in `src/core/main.js`. Each frame it calls the current state owner's `update(dt, state)` and then renders. Never call `requestAnimationFrame` or `graphics.render`.
- **Every module** (`src/<name>/index.js`) does `export default { init, enter, update, exit }`, and every member is optional. In `enter(state, data)`, call `graphics.setView(yourScene, yourCamera)`. `exit` runs when your state ends, and main clears keys and UI between states.
- **Who owns which state** (from `STATE_OWNERS` in `contract.js`):

| State | Owner module | Role |
|---|---|---|
| `MENU` | `builder` | 1 |
| `HANGAR` | `builder` | 1 |
| `GONOGO` | `builder` | 1 |
| `PRELAUNCH` | `story` | 4 |
| `LAUNCH` | `flight` | 2 |
| `ORBIT` | `flight` | 2 |
| `CRUISE` | `cruise` | 4 |
| `ENTRY` | `flight` | 2 |
| `LANDING` | `flight` | 2 |
| `INTERIOR` | `surface` | 2 |
| `SURFACE` | `surface` | 2 |
| `RETURN` | `story` | 4 |
| `ENDING` | `story` | 4 |
| `REPORT` | `report` | 4 |

  `missions` and `guidebook` own no state. They only listen to events.
- **Talk through events.** Use `events.emit` and `events.on` from `/src/core/index.js`, and change state with `requestState`. Import from another role only through its `index.js`.
- **One door for each shared thing.** Keys and mouse only through `input`, UI only through `ui.mount`, saves only through `save`, money only through `economy`, gravity only from `PLANETS`.
- **Never invent a name.** Every event, state, ending, task and station is in `src/core/contract.js`. If you need a new one, stop and tell your human, because all four people must agree.
- **Example of a flow across roles.** Role 2's flight code emits `flight:failed` with an `endingId` and a `cause`. Role 4's story module hears it, calls `economy.chargeFailure`, emits `ending:show` and requests `ENDING`. The black box in `src/report/` hears the same `flight:*` events and records them for the Flight Report.
- **Stubs** in every module folder start with `STUB: Role N replaces this`. They make the whole loop playable with buttons, and `npm run check` walks that loop.

## Roles

| Role | Owner | Branch | Your folders | Spec sections |
|---|---|---|---|---|
| 1. Rocket Builder | Quoc Thai Nguyen ([@Myklede](https://github.com/Myklede)) | `role1-builder` | `src/builder/` | §3, §5, §8 |
| 2. Flight & Astronaut | Minh Vuong ([@laibaminhvuong-ux](https://github.com/laibaminhvuong-ux)) | `role2-flight` | `src/flight/`, `src/surface/` | §4, §6, §7 |
| 3. Graphics, Audio & Core | dtri ([@dtri2206](https://github.com/dtri2206)) | `role3-graphics` | `src/core/`, `src/graphics/`, `src/audio/`, `src/ui/` | §12, §14, §15 |
| 4. Story, Cruise & Knowledge | Le Quoc Viet Pham ([@quocviet1207](https://github.com/quocviet1207)) | `role4-story` | `src/cruise/`, `src/story/`, `src/missions/`, `src/guidebook/`, `src/report/` | §2, §6.3, §8, §9, §10, §11, §13 |

Models, textures and audio go in `public/assets/`, and everything used is credited in `CREDITS.md`.

### Role 1: Rocket Builder

**You build:** main menu, content warning and settings, hangar computer UI, LEGO-style builder, engine workbench, Formula Lens, Go/No-Go poll, preset ships. You also own the rules of the economy as data in `src/core/balance.json`. For any change to `economy.js` or anything else in `src/core/`, ask dtri.

**Next tasks:**
1. Replace the stubs in `src/builder/` with the real builder, keeping every export in `PUBLIC_EXPORTS`. That includes the main menu (`src/builder/menu.js`).
2. Implement `builder:highlightPart`, and tune `src/core/balance.json` with the team.
3. Tier 0: basic parts and snapping, text Go/No-Go, the failure penalty numbers, the "Reliable" preset.

**You use:** theme CSS (Role 3), guidebook text (Role 4), `assets.get('rocketPart:<id>')` (Role 3), and `src/core/` (economy, save, ship mocks).

### Role 2: Flight & Astronaut

**You build:** flight controller (physics and cockpit controls), Flight Assist, launch/orbit scene, entry/landing scene, Max-Q and G meters, first-person walking (ship interior and Mars EVA), interactable system, stations, airlock, suit, oxygen.

**Next tasks:**
1. Replace the stubs in `src/flight/` and `src/surface/` with the real thing, keeping every export in `PUBLIC_EXPORTS` (`FlightController`, `registerInteractable({id, position, prompt, onUse})`) and the `flight:*` and `eva:*` events.
2. Build the first-person walking controller. None exists yet: the stubs hold the camera still, and the camera is yours to move. Eye height is about 1.65 m. Pick an interaction range and write it in `docs/DECISIONS.md`.
3. Tier 0: launch to orbit, entry to landing, interior with seat, suit, airlock and O₂ station, EVA with oxygen.

**You use:** `getShip()` from `src/core/` (it returns the Reliable mock until the builder works), and from Role 3 `getTerrainHeight`, `createMarsScene`, `createSpaceScene`, `assets.get('cockpit')` and `assets.get('cabin')`.

### Role 3: Graphics, Audio & Core

**You build:** renderer and post-processing, skybox, Earth and Mars with atmosphere shaders, cockpit, cabin and Mars visuals, VFX (flame, plasma, dust), HUD theme, cinematic API, all sound, Low/High quality settings.

**You also keep `src/core/`** (the game loop, state machine, events, input, UI layer, save, economy, contract and the `?debug=1` panel) and `npm run check`. You review any change to it that another role asks for, and confirm `dev` is healthy before it moves to `main`.

**Next tasks:**
1. Listen to the audio director on real speakers and tune its levels (nobody has heard it yet).
2. Measure frame rate and the automatic resolution on a real mid-range laptop.
3. Rocket parts and the launch-site ground have a first art pass (panel seams, windows, scrub plain); review them in `/sandbox/role3.html?view=parts` and `?view=pad`.

**You use:** nothing blocking. Work in `/sandbox/role3.html`.

### Role 4: Story, Cruise & Knowledge

**You build:** cruise scene (map, time-warp, day counter, launch window, solar storm, malfunction, family messages), story and Halcyon-1 logs, Mars tasks and progress, ending screens and sequences, black box and Flight Report, Guidebook, all narrative and educational text, demo script.

**Next tasks:**
1. Replace the stubs in `src/cruise/`, `src/story/`, `src/missions/`, `src/guidebook/` and `src/report/` with the real thing, keeping every export in `PUBLIC_EXPORTS`.
2. Add text JSONs (tips, Go/No-Go lines, Formula Lens analogies) and task placement data.
3. Tier 0: cruise map with 1 encounter, 1 task of each type, 1 ending screen.

**You use:** `registerInteractable` and `FlightController` (mock them until Role 2 delivers), `cinematic.play`, `audio.play` and mission props from `assets.get` (Role 3).

### Parts the spec leaves unassigned

| Part | Owner |
|---|---|
| Main menu, content warning, Esc menu, settings | Role 1, built in `src/builder/` |
| Pre-launch screen (family photo, message home) | Role 4 |
| Return and first-step cinematics | Role 4, using Role 3's cinematic API |

## Status

Update your row whenever you push to `dev`.

| Role | On `dev` now |
|---|---|
| 1 | Real modules. **Menu** (`MENU`): title, funds, last outcome, content warning on first launch, settings. **Engineering bay** (`HANGAR`): a round integration hall you walk through in first person (WASD, mouse, Shift run, Space jump, `E` to use a machine, `H` handbook, `Esc`), as a human body (CesiumMan, CC BY, clipped at the neck) with a tablet in hand. The vehicle stands on a hold-down stand with a service tower; 22 parts are real NASA hardware (Space Shuttle main engine, ESAS and Stardust capsules, Shuttle RCS, Satellite Kit wings and antennas, ORU), tanks, cones, shields and fins are detailed procedural models. Launch-control desks (three monitors, keyboard, lit nameplate, equipment cabinet) with real NASA hardware around them: a Shuttle engine on a dolly, Robonaut 2, Mark III, EMU and ACES suits, Ingenuity, RASSOR, CubeSats, a Mobile Launcher model, spare parts on pallets; a wall screen fed by a camera. Every design desk opens the **vehicle design page**: the stack drawn top to bottom like NASA's Dawn launch-vehicle diagram with labelled parts; click a part (or `+ Add a part`) and a row of picture cards appears with role, pros / cons, mass, price, plus **material** choices (alloys, chamber metals) with their own pros, cons and cost; an empty stand shows HEAD / BODY / TAIL; the wheel zooms around the pointer; a build checklist and plain-language warnings on the side, Formula Lens under SHOW THE NUMBERS. Also: engine workbench (chamber + nozzle + pump), undo/redo, presets, blueprints, share codes, test console (static fire + hold-down liftoff test with a report), range terminal (launch windows), engineer's handbook (guide + your own notes). CC0 Poly Haven HDRI, PBR textures and 19 props in `public/assets/polyhaven/`. **Readiness poll** (`GONOGO`): consoles report in turn from the test conductor's desk, hard blocks refuse, warnings can be overridden; Confirm spends vehicle + pad fee, calls `setShip`, emits `ship:built`. `openPauseMenu()`/`openSettings()` are exported from `/src/builder/index.js`. Debug: `window.__game.builder.placeAt(id)` / `openStation(id)`. Tests: `node src/builder/tests/builder.test.mjs`. |
| 2 | Real modules, on `dev`. **Flight** (`LAUNCH`, `ORBIT`, `ENTRY`, `LANDING`): Newtonian `FlightController` (thrust, 1/r² gravity, drag, fuel burn, Max-Q, g-force, entry heating, chute, touchdown, debris + armor, Cold Morning / The Foam hooks). LAUNCH starts on Role 3's launch site with the player's rocket built from `ShipSpec.parts`; Flight Assist has a trajectory line, prograde/retrograde markers, a gravity-turn guide (◎ + prompts) and an entry/landing guide (BURN NOW). LAUNCH→ORBIT and ENTRY→LANDING happen on their own; in ORBIT an orbital-debris encounter comes after 20 s, and T is the transfer burn → CRUISE. Δv per leg is measured and explained in `docs/DECISIONS.md`; a test flies the Reliable mock through the whole mission. **Surface** (`INTERIOR`, `SURFACE`): walking with Mars gravity on the real cabin and terrain, all 7 contract stations, airlock, suit O₂ (30/15/5 %, `outOfBreath`), helmet HUD, head bob, suit breach on a bad fall. A crewed rover modelled on the Apollo LRV (`RoverController`: 13 km/h governor, 3.1 m turning radius, grip μ·g, power-limited climbs, long low-g hops over crests, rollover past 40°, 8.7 kWh battery) is parked by the lander: E to drive, W/S, A/D, Space brake, E to get out. `registerInteractable({ id, position, prompt, onUse, hold?, radius?, state? })`: give `state: 'SURFACE'` for Mars tasks. Dev shortcuts (Enter, O, R) work only with ?debug=1; screens mark themselves with data-screen. Tests: `node src/flight/tests/flight.test.mjs` and the files in `src/surface/tests/`. |
| 3 | All hour-3 APIs below. See every view at `/sandbox/role3.html`. Earth and Mars use real maps; the rest of the art is generated in code. Cabin, VFX, launch site (now used in `LAUNCH`), mission props and the rocket parts (seams, windows, hatch, pumps) are built; real sound files with a synth fallback; the audio director (`src/audio/director.js`) plays ambience, radio and O₂ alarms from events; the cockpit window spans about -17 to +30 degrees so the sky dominates, and its 3 screens sit below the default view (look down to read them), which keeps the HTML HUD over plain dark dash; the cockpit screens show live `flight:telemetry`; automatic resolution holds frame rate (`graphics.setAutoResolution`, `graphics.pixelRatioNow`); `?debug=1` has a Low/High quality choice. |
| 4 | Stubs in `src/cruise/`, `src/story/`, `src/missions/`, `src/guidebook/` and `src/report/`: a day counter and Next button for cruise, a plain ending screen, and a report showing event counts. No story text yet. |

The full game loop plays with these stubs at `/`.

## Core APIs

```js
import { events, getState, requestState, input, ui, economy, save, getShip, setShip, PLANETS, G0, contract } from '/src/core/index.js';
```

Stubs and tests may also import `/src/core/stubScreen.js` and `/src/core/mocks/*.json`, and anyone may import `three`.

| API | What it does |
|---|---|
| `events.on(name, fn)`, `once`, `off`, `emit(name, payload)` | Talk to other roles. `on` returns a function that unsubscribes. Unknown names and missing keys log an error. |
| `getState()`, `requestState(to, data)` | Current state, and asking to change it. `data` is passed to the next module's `enter(state, data)`. Invalid changes are refused and logged. |
| `input.isDown(code)`, `onPress(code, fn)`, `onEscape(fn)`, `mouseDelta()` | Keys use `KeyboardEvent.code`, such as `KeyW`. Handlers are removed on every state change, so register them in `enter`. |
| `input.lockPointer()`, `unlockPointer()`, `isLocked()` | Mouse look. Browsers only allow locking from a click or key press. |
| `ui.mount(element, { layer })`, `mountPersistent`, `unmount` | Puts your HTML on screen, using the HUD classes below. `layer` is `'hud'` or `'menu'` (default). Mounted elements are removed on every state change; persistent ones stay until you unmount them. A real screen sets `data-screen="<STATE>"` on its root element (`npm run check` accepts that in place of a stub panel). Position them with your own CSS. Mounted elements catch clicks unless you set `element.style.pointerEvents = 'none'` before mounting (do that for a full-screen HUD layer). |
| `economy.getMoney()`, `canAfford(cost)`, `spend(cost, reason)`, `reward(amount, reason)`, `chargeFailure(shipCost)`, `isBankrupt()`, `reset()` | The only way to change money. Numbers come from `src/core/balance.json`. |
| `save.load()`, `save.update(partial)`, `save.reset()` | The only way to use `localStorage`. |
| `getShip()`, `setShip(spec)` | The current ship. `getShip` returns the Reliable mock until a ship is built. |
| `PLANETS.earth.g`, `PLANETS.mars.radius`, `G0` | The only source of gravity and planet numbers. |

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
| `createLaunchSite()` | `{ scene, root, rocketBase, setAltitude(metres) }`. A coastal launch complex with the pad at the origin, Earth below with its sky. Stand your rocket at `rocketBase` (add it to `root`). Call `setAltitude(m)` as it climbs, and keep the camera near the origin: the site and planet slide down instead. The detail hides above 40 km. Set the Sun with `graphics.setSunDirection`. |
| `assets.setRocketPartArt(fn)` | Lets Role 1's hangar models show on the pad. `fn(type)` is called synchronously by `assets.get('rocketPart:<type>')` and returns an Object3D, or `null` to use the built-in part (pass `null` to clear; a throw also falls back, with one warning per type). Flight places each object at the ShipSpec part's (x, y, z) with `rotation.y` = rotation degrees. Axial parts have their origin at the base of the part on the rocket axis and should set `userData.height` in metres (computed from the bounding box if missing). Radial parts have their origin at the attachment point on the parent's surface with local +x pointing outward, so bake any outward offset the hangar uses into the object. Return only models that are already loaded, otherwise `null`. |
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
| `cabin` | 4 × 8 m, with the origin at the middle of the floor. `userData.stations` holds positions for `pilotSeat`, `o2Station`, `suitLocker`, `commsConsole`, `sampleStorage`, `airlock` and `bunk`, in the cabin's local coordinates, so add the cabin's position if you move it. `userData.props` holds `foodRack`, `waterRecycler`, `exerciseBike` and `familyPhoto`. `userData.setAlarm(true)` dims the lights and pulses a red one. |
| `vfx:engineFlame` | Origin at the nozzle exit, plume down -Y, built for a 0.95 m nozzle (scale it for others). `userData.set({ throttle: 0..1, airDensity: 0..1, fuel: 'kerolox' \| 'methalox' \| 'hydrolox' })`. Sea-level plume has shock diamonds, vacuum balloons wider and fainter. Carries a point light. |
| `vfx:exhaust` | Origin at the nozzle exit, smoke falls down -Y. `userData.set({ throttle: 0..1, airDensity: 0..1 })`. Invisible in vacuum. |
| `vfx:entryPlasma` | Add it to the cockpit group (its coordinates). `userData.set({ intensity: 0..1 })`. Streaks outside the window, and an orange light inside. |
| `vfx:landingDust` | Origin on the ground under the engine, +Y up. `userData.set({ intensity: 0..1 })`. A sheet of dust up to about 40 m wide. |
| `planet:earth`, `planet:mars` | Radius 1, so set `planet.scale.setScalar(radius)`. To spin it, rotate `userData.surface`, not the group. Call `await assets.preload(['planet:earth', 'planet:mars'])` during loading so no placeholder shows. |
| `rover` | Crewed LRV-style Mars rover, real scale (about 3.1 m long). The origin is on the ground at the centre of the wheelbase (2.29 m) and track (1.83 m), wheels rest on y = 0, forward is -Z, +X is right, and the root carries no transform. Four pivots named `wheelFL`, `wheelFR`, `wheelRL`, `wheelRR` at the wheel centres: set the pivot's `rotation.y` to steer and its first child's `rotation.x` to spin. The driver's eye is (-0.32, 1.48, 0.22). `userData.setDust(0..1)` adds Mars dust. No lights. |
| `rocketPart:<id>` | The look comes from words in the id: `capsule`, `tank`, `engine`, `nose`, `fin`, `leg`, `heat`. Size comes from `_s`, `_m` or `_l`. `userData.height` is the stacking height. |
| `lander`, `halcyonLander` | Your ship and the lost crew's wreck |
| `scanPoint`, `sampleRock`, `discoveryRock`, `solarPanel`, `iceDeposit`, `dataLog`, `halcyonLander` | Mission props (the last one is the wreck). The origin is on the ground, `userData.height` is in metres, and `userData.setState('idle' \| 'active' \| 'done')` turns the light amber, cyan or green. `discoveryRock` only shows a ring when active. |

**HUD classes:** `.hud`, `.hud-panel`, `.hud-label`, `.hud-value`, `.hud-bar` (set `--value` from 0 to 1), `.hud-button`, and the states `.hud-ok`, `.hud-good`, `.hud-caution`, `.hud-alert`.

**Keep the camera near the origin in space scenes, and move the planets instead.** At 640,000 m from the origin, a 32-bit position is only good to about 6 cm, and the cockpit would visibly shake.

## Role 2 APIs you can use now

Import only from the public files: `/src/flight/index.js` and `/src/surface/index.js`.

**Mars tasks (Role 4): `registerInteractable`**

```js
import { registerInteractable } from '/src/surface/index.js';
import { getTerrainHeight } from '/src/graphics/index.js';

const y = getTerrainHeight(40, -25);
const off = registerInteractable({
  id: 'sampleBasalt',            // any unique id
  state: 'SURFACE',              // only usable in this state ('SURFACE' or 'INTERIOR'); omit = everywhere
  position: { x: 40, y: y + 0.3, z: -25 },   // metres in that scene (Mars: landing site/lander at the origin)
  prompt: 'Hold E: collect basalt',
  hold: 2,                       // seconds of holding E (0 or omitted = one press)
  radius: 2.2,                   // how close the player must be (default 1.6 m); they must also look at it
  onUse: () => events.emit('task:completed', { taskId: 'sampleBasalt', category: 'sample', reward: 150000 }),
});
// off() removes it again
```

Register once (for example in your module's `init()`); the `state` filter decides when it is active. Place your
mission prop model (`assets.get('sampleRock')`) in the scene yourself; the shared Mars scene is the one Role 2 shows
in SURFACE, so add props to it from `enter('SURFACE')` or keep a reference across states.

**What Role 2 reads from `ShipSpec`** (contract units: kg, N): `stats.dryMass`, `fuelMass`, `thrust`, `ispSL`,
`ispVac`, `hasHeatShield`, `heatShieldDamaged`, `hasLegs`, `hasRCS`, `hasParachute`, `coldRatedSeals`, `armorHits`,
`spareO2Tanks`, `launch.tempC` (below 5 °C with `coldRatedSeals: false` → Cold Morning), `engines[0].pump`
(engine heat), `parts` (the rocket model in the chase camera: axial parts are stacked by real height, side parts
follow). Optional realism: `stats.minThrottle` (e.g. 0.4) and `stats.ignitions` (e.g. 3). Bad or missing numbers fall
back to safe defaults, never NaN.

**What Role 2 sends** (all in `contract.js`):

| Event | When |
|---|---|
| `flight:phase` | `prelaunch`, `ascent`, `orbit`, `coast`, `entry`, `landing`, `landed` |
| `flight:event` | `maxq`, `debris_hit`, `blackout` (g-force), `skip_off` |
| `flight:telemetry` | 2 Hz in every Role 2 state: `t, phase, altitude, speed, gForce, q, fuelKg, engineTemp, radiationMsv`; in INTERIOR/SURFACE `o2Percent, heartRate, radiationMsv` |
| `flight:landed` | touchdown under 3 m/s and upright |
| `flight:failed` | `endingId`: `rud`, `burnup`, `adrift`, `coldMorning`, `theFoam`, `outOfBreath`; `cause` is one sentence; extras `causeId`, `historyHint` (`challenger`, `columbia`) |
| `interior:interact` | `pilotSeat`, `o2Station`, `suitLocker`, `commsConsole`, `sampleStorage`, `airlock`, `bunk` |
| `eva:oxygen` | every whole percent |
| `guidebook:open` | cabin props: `crew-exercise`, `crew-water`, `crew-food`, `family-photo` (Role 4, please create these entries) |

**State moves Role 2 makes:** LAUNCH→ORBIT on reaching orbit; ORBIT→CRUISE after the transfer burn (T, Δv from
`balance.json`; not enough Δv → `adrift`); ENTRY→LANDING below 6 km; LANDING→INTERIOR (E after touchdown);
INTERIOR→SURFACE (airlock), SURFACE→INTERIOR (hatch), INTERIOR→LANDING (pilot seat), INTERIOR→RETURN (pilot seat when
`getProgress().percent` is 100).

## Known gaps in the spec

These are not decided yet. If your work touches one, raise it with your human instead of guessing.

- **Economy (Role 1):** with the cheapest viable ship at $2.5–3M (§5.6), one failure leaves $1.15–1.75M. That can't pay for another ship, but it stays above $0, so the Bankrupt ending never fires. Surviving 2 failures needs a ship of about $1.3M or less.
- **Δv (Roles 1, 2):** `src/core/balance.json` holds provisional Δv numbers per leg (ascent, transfer, landing, return) that still need the team's agreement. A rough estimate for the round trip is 8.9 km/s, about 92% fuel by mass on one stage, while staging is Tier 3 and Mars refuelling is Tier 2.

## Getting work to `main`

1. On your role branch, run `git merge origin/dev`, then `npm run check`, and fix everything it reports. Then push with `git push origin HEAD:dev`. If someone pushed first, git refuses: merge again and repeat. `npm install` also adds a pre-push hook that runs this check on every push to `dev` and refuses pushes to `main`. Never bypass it.
2. Tell your human. They ask the team to check `dev`.
3. When everyone agrees and dtri confirms `dev` is healthy, dtri moves `dev` to `main`. Nobody else pushes to `main`.

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

Everyone merges finished work into `dev` at hours **12, 18, 24, 30, 36 and 42**, and `npm run check` covers that it still boots. dtri confirms before `dev` moves to `main`.
