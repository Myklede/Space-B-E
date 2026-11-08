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
| 1 | Real modules. **Menu** (`MENU`): title, funds, last outcome, content warning on first launch, settings. **Engineering bay** (`HANGAR`): a round integration hall walked in first person (WASD, mouse, Shift, Space, `E` use, `H` handbook, `Esc`) with launch-control desks, real NASA hardware and a wall screen. **Vehicle design page** (every design desk): the ship in 3D on its launch pad (drag to turn, wheel to zoom, click a part) and four cards, **Nose**, **Body**, **Tail**, **Launch pad**. Each card starts from a real section: 28 noses (Mercury, Vostok, Apollo, Soyuz, Orion, Crew Dragon, Starliner, Shenzhou, cargo craft, payload fairings…), 29 bodies (S-IC, the Shuttle tank, SLS, Atlas V, Titan II, Delta IV, Long March 5…), 31 tails (Saturn V's five F-1s, the Octaweb, N1's thirty engines, Super Heavy, solid and liquid boosters…) and 31 real launch complexes (LC-39A, SLC-40, Starbase, Baikonur, Kourou…), then its components and the deep internals: 228 parts with 29 kits of real options (cycles, injectors, nozzles, insulation, docking, couches…), each with its real reference, pros and cons. 157 Blender models (`public/assets/models/builder/`, 13 MB, scripts in `src/builder/tools/blender/`) snap onto the stack; only the chosen look of each inner piece shows. The game wraps the stack in one **seamless outer skin** (skirts, interstages, cones, fairings, an automatic equipment bay) with a skin material per section (mass, heat on the climb, buckling at max-Q, drag, wear). Engine clusters get a series-production discount (Wright's law, 85 %). **Luck, FIFA style:** the confirmed ship comes out of the factory a little off its design, rare defects follow each part's reliability, TEST FIRE can catch them, and an **investigation board** (English/Vietnamese) explains a failure afterwards; the design page gives no hints. The **readiness poll** (`GONOGO`) speaks like flight controllers, with launch-day weather at the chosen complex and HOLD. Clicking any part opens a **big explanation card** (what it does, how it works inside in an exploded 3D view, numbers in everyday words; EN/VI). The flight scenes get Role 1's art through `assets.setRocketPartArt`, `builder:launchPad` and `builder:rocketSkin` (all four agreed). **Part effects in flight** (all four agreed, in progress): `ShipSpec.stats.traits` (`src/builder/traits/`) and hooks in `FlightController` (`src/flight/effects/`), neutral until the effects land; each flight's record goes to `save.partEffects`. Also: undo/redo, CLEAR ALL, four presets (Reliable, Workhorse, Cold Morning, Thin Skin), blueprints, share codes, test console, handbook. Debug: `/?debug=1&state=HANGAR&station=integration`; `window.__game.builder.placeAt(id)` / `openStation(id)`. Tests: `node src/builder/tests/<builder|hull|card|luck|pad|models>.test.mjs`. |
| 2 | Real modules, on `dev`. **Flight** (`LAUNCH`, `ORBIT`, `ENTRY`, `LANDING`): Newtonian `FlightController` (thrust, 1/r² gravity, drag, fuel burn, Max-Q, g-force, entry heating, chute, touchdown, debris + armor, Cold Morning / The Foam hooks). LAUNCH starts on Role 3's launch site with the player's rocket built from `ShipSpec.parts`; Flight Assist has a trajectory line, prograde/retrograde markers, a gravity-turn guide (◎ + prompts) and an entry/landing guide (BURN NOW). LAUNCH→ORBIT and ENTRY→LANDING happen on their own; in ORBIT an orbital-debris encounter comes after 20 s, and T is the transfer burn → CRUISE. Δv per leg is measured and explained in `docs/DECISIONS.md`; a test flies the Reliable mock through the whole mission. **Surface** (`INTERIOR`, `SURFACE`): walking with Mars gravity on the real cabin and terrain, all 7 contract stations, airlock, suit O₂ (30/15/5 %, `outOfBreath`), helmet HUD, head bob, suit breach on a bad fall. Two crewed rovers are parked by the lander (`RoverController`: grip μ·g, power-limited climbs, long low-g hops over crests, rollover past 40°): the Apollo LRV (13 km/h governor, 3.1 m turning radius, 8.7 kWh) from the start, and the concept MR-01 (about 20 km/h, 30 kWh) locked until Mars Exploration reaches 50 % (`progress:changed`; `?debug=1`: U unlocks it). E to drive, W/S, A/D, Space brake, E to get out. `registerInteractable({ id, position, prompt, onUse, hold?, radius?, state? })`: give `state: 'SURFACE'` for Mars tasks. Dev shortcuts (O, R) work only with ?debug=1, and there Enter skips to the next game state (`src/core/skip.js`); screens mark themselves with data-screen. Tests: `node src/flight/tests/flight.test.mjs` and the files in `src/surface/tests/`. |
| 3 | All hour-3 APIs below. See every view at `/sandbox/role3.html`. Earth and Mars use real maps; the rest of the art is generated in code. Cabin, VFX, launch site (now used in `LAUNCH`), mission props and the rocket parts (seams, windows, hatch, pumps) are built; real sound files with a synth fallback; the audio director (`src/audio/director.js`) plays ambience, radio and O₂ alarms from events. The Shuttle-style flight deck v3.1 model is now the `LAUNCH` cockpit, with live propulsion, attitude and guidance displays; it loads during the menu/hangar, falls back to the procedural cockpit if the GLB cannot load, and preserves the stable cockpit APIs below. Automatic resolution holds frame rate (`graphics.setAutoResolution`, `graphics.pixelRatioNow`); `?debug=1` has a Low/High quality choice. |
| 4 | Real modules. **Cruise** (`CRUISE`): Hohmann transfer map, day counter, time warp (1–3), comms delay, distance, radiation dose, a solar storm (S: shelter) and an Apollo 13-style malfunction, then ENTRY. **Missions**: 9 Mars tasks placed from `src/missions/tasks.json` with Role 3's props and Role 2's `registerInteractable`, a mission HUD with an arrow to the next task, logs uploaded at the comms console, rewards paid, exact 100 %, `mission:complete`. **Story**: pre-launch (family photo + message home), HQ/family radio, Halcyon-1 logs, the return cinematic, and ending screens for every ending with the 9 history lessons; Adrift is the full §10.3 sequence. **Report**: black box and Flight Report (timeline, root cause, astronaut and ship stats, recommendations with "Show part"). **Guidebook**: 37 entries with sources, corner cards (Q closes) and a full index (`guidebook:open { entryId: 'index' }`). Debug: `window.__role4.missions`. Not yet: return Δv vs sample mass, return-window timer, first-step cinematic. |

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
| `input.isDown(code)`, `onPress(code, fn)`, `onEscape(fn)`, `mouseDelta()`, `wheelDelta()` | Keys use `KeyboardEvent.code`, such as `KeyW`. Mouse buttons are key codes too: `Mouse0` (left), `Mouse1` (middle), `Mouse2` (right), for `isDown` and `onPress`; they fire only while the pointer is locked (the click that locks it does not count), are released when the lock is lost or the window blurs, and the right-button context menu is blocked only while locked. Handlers are removed on every state change, so register them in `enter`. `wheelDelta()` is the mouse wheel `deltaY` in pixels summed since the last call (positive = wheel down; lines and pages are converted to pixels) and resets like `mouseDelta()`; the page never scrolls under the game, but HTML panels that scroll themselves (Guidebook, report) keep their own wheel. |
| `input.lockPointer()`, `unlockPointer()`, `isLocked()` | Mouse look. Browsers only allow locking from a click or key press. |
| `ui.mount(element, { layer })`, `mountPersistent`, `unmount` | Puts your HTML on screen, using the HUD classes below. `layer` is `'hud'` or `'menu'` (default). Mounted elements are removed on every state change; persistent ones stay until you unmount them. A real screen sets `data-screen="<STATE>"` on its root element (`npm run check` accepts that in place of a stub panel). Position them with your own CSS. Mounted elements catch clicks unless you set `element.style.pointerEvents = 'none'` before mounting (do that for a full-screen HUD layer). |
| `economy.getMoney()`, `canAfford(cost)`, `spend(cost, reason)`, `reward(amount, reason)`, `chargeFailure(shipCost)`, `isBankrupt()`, `reset()` | The only way to change money. Numbers come from `src/core/balance.json`. For testing, `npm run dev` and `?debug=1` start every page load with $1,000,000,000; add `?money=5000000` (any amount) to test the real economy. The built game uses `startMoney` and the save as before. |
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
| `audio.play(id, { volume, loop, rate })`, `audio.stop(id)` | Sounds. `audio.ids()` lists them. Phase 0 (synthesised, all on the `ui` bus): `crew.harness` (buckle click), `cockpit.hatch` (heavy latch), `cockpit.pressurise` (2.8 s rising then falling hiss), `suit.o2flow` (soft airflow, loops until `audio.stop`), `cockpit.switch` (toggle click). Manual-control and debris-dodge windows: `cockpit.manualOffer` (two-tone chime), `cockpit.lock` (confirm beep), `rcs.puff` (short thruster hiss, every call is an independent burst), `debris.whoosh` (a piece passing close, `world` bus). Zero-g cabin (`ui` bus): `cabin.fans` (soft ventilation, loops until `audio.stop`), `crew.push` (push-off thump and suit rustle), `handrail.grab` (glove on metal). |
| `audio.setAir(0..1)` | Thins engine sound with altitude: 1 at sea level, 0 in vacuum |

**`assets.get(name)`** always returns an `Object3D`, and a new one on each call. A name with no art yet shows a hologram and logs a warning.

| Name | Notes |
|---|---|
| `cockpit` | The origin is the pilot's eye and forward is -Z. For a capsule ship the cockpit is that capsule's crew cabin (`public/assets/models/cockpit/<id>.glb`, built by `scripts/blender/capsuleCockpit.py`; the demo ship uses `apollo`), chosen from `stats.cabin.type` or the capsule part (`src/graphics/capsuleCockpit.js`); Dream Chaser, Starship or a ship without a capsule get the flight deck below. Capsule cockpits also have `userData.reach(id) → seconds` (the nearest gloved hand leaves its controller, presses that button at contact and returns; the result is the seconds until contact), `userData.openHatch(t)` (0 closed … 1 open) and the nodes `aftHatch` and `ladderTop` (the hatch and the standing eye position at it) for the egress. The default v3.1 model is `public/assets/models/flightdeck.glb`, generated by `scripts/blender/flightdeck.py`; `src/graphics/interiors.js` supplies the procedural fallback if it fails to load. `userData.setAlarm(true)` turns on the red alarm. `userData.setControls({ pitch, yaw, throttle, cutoff, brake, assist })` (pitch and yaw -1…1, W = nose down = -1; throttle 0…1; `cutoff`, `brake`, `assist` booleans; omitted keys keep their last value) moves the joystick and throttle lever and animates the guarded red `X  CUT-OFF` toggle, the amber `SPACE  LOCK` button (`brake: true` presses it in; a pulse of about 0.3 s, even one frame, shows a full press) and the cyan `F  MANUAL` button (`assist: true` lights it = the player has manual control); call it every frame. `userData.setButton(id, 'off' | 'amber' | 'green' | 'red')` lights a button-row lamp and `userData.press(id)` plays a 0.3 s press-in; ids are `hatch`, `cabin`, `o2`, `arm` (ARM ENGINE), `fire`, `dump`, `rcs-a`, `rcs-b`, `main`, `apu`, `pwr`, `comms`, `dock`, `para`, `entry`, with or without the `btn:` prefix (they return `false` for an unknown id). `userData.setTrajectory({ planned, predicted, ship: { x, y, heading }, view: 'side' | 'top', hint: { text, level: 'ok' | 'warn' } })` draws the steering display in the centre screen: `planned` is a dashed white line, `predicted` a brighter solid cyan line, the ship an amber triangle, the hint large in green (`ok`) or amber (`warn`). **Coordinates are screen units 0…1 of the plot area, x to the right and y UP (0,0 is bottom-left); `heading` is in radians, 0 = pointing right, counter-clockwise positive (pi/2 = up).** Call it a few times a second (it redraws only when the data changed, at most 10 times a second); `setTrajectory(null)` returns the display to the telemetry plot. `userData.setAim({ target: { x, y }, aim: { x, y }, radius, accuracy, timeLeft, lockReady, label })` draws the manual-window aim on top of the same centre display (also with no trajectory set): a white `+` target, a cyan `○` aim circle of `radius` (same 0…1 units, y UP, measured against the plot width), an amber-to-green accuracy bar (`accuracy` 0…1), the seconds left (`timeLeft`), the title (`label`, e.g. `ASCENT · GRAVITY TURN`) and, when `lockReady` is true, a `LOCK READY · SPACE` cue. Optional `nose: { x, y }` (same units) draws a small amber triangle where the ship's nose really points (omitted = not drawn). `setAim(null)` removes it. `userData.setConjunction({ objects: [{ x, y, r, t }], aim: { x, y }, range, label, dv, hits, passed })` replaces the centre display with the debris conjunction view (view along the velocity, ship in the centre, `x, y, r` in 0…1 with y UP, `t` = seconds to closest approach, `range` = metres from the centre to the plot edge, `dv` m/s): red circles at the predicted miss points growing as they near, an amber countdown on the nearest, a cyan `○` aim, and a Δv / hits line; `setConjunction(null)` hands the display back. The pages read the live `flight:telemetry` values (thrust, TWR, Isp, Δv left, throttle, fuel, pitch/yaw/roll and rates) and fall back to the ship stats before the first telemetry. It shares the 10-redraws-a-second limit and redraws only when a value changed. **`setControls`, `setTrajectory`, `setButton`, `press`, `setAlarm` and the mesh name `centreDisplay` are stable APIs: every future cockpit redesign must keep them working with the same arguments.** **Aft hatch route (Apollo, `capsule_apollo`):** `aftHatch` is a round 0.75 m hatch in the aft bulkhead behind the head end of the centre couch, at cockpit (0.54, 0.48, 0.51) (game frame, +Z = behind the back, the hatch opens up toward the crew); `openHatch(t)` swings it, the old crew hatch is now `sideHatch` (`openSideHatch(t)`). `ladderTop` is the floating/standing eye in front of the open hatch, (0.54, 0.43, -0.29), looking through it (+Z, `rotation.y = PI`, up = +Y); `aft` is the same point. No passage: a 0.25 m steel collar runs from the hatch (z 0.51) to `passageEnd` (z 0.76), where the cabin's bulkhead hatch begins. `userData.harness(t)` 0 buckled … 1 released (all three couches: the buckle opens, the five straps lift and drift). `userData.attachCabin(cabin)` puts `assets.get('cabin')` right behind the couches, like an airliner cabin behind its cockpit: same axes as the cockpit (no rotation), its -Z bulkhead hatch centred on the collar end, so the open aft hatch looks straight down the cabin aisle (+Z) to the airlock; it adds no light (the cockpit's own cyan screen light becomes the cabin's warm light and follows the viewer), hides the painted window views so the windows show the real scene, and returns the cabin; `userData.detachCabin()` undoes it and returns the cabin (for Mars INTERIOR). `userData.prepareCabin(cabin?)` (optional, async) builds a cabin if none is given, hangs it hidden and compiles its shaders in the real scene: call it on entering ORBIT and `attachCabin` costs nothing (warm-up already pre-builds one cabin and compiles it). `userData.floatPath` is an array of `Object3D` waypoints in cockpit space (`wp_couch` = the centre couch eye, `wp_over` above the head rest, `wp_front` in front of the hatch, `wp_mouth` in the hatch, `passageEnd` at the collar end, then `cabinEntry` once a cabin is attached: 1.1 m into the aisle at standing eye height, facing +Z). |
| `cabin` | 4 × 8 m, with the origin at the middle of the floor. `userData.stations` holds positions for `pilotSeat`, `o2Station`, `suitLocker`, `commsConsole`, `sampleStorage`, `airlock` and `bunk`, in the cabin's local coordinates, so add the cabin's position if you move it. `userData.props` holds `foodRack`, `waterRecycler`, `exerciseBike` and `familyPhoto`. `userData.setAlarm(true)` dims the lights and pulses a red one. Built in `src/graphics/cabin.js` and `cabinParts.js`: rack modules, stowage, handrails, cable trays, a front window and portholes onto Mars, and a recognisable model for every station and crew-life prop (food rack, water recycler with a plant chamber, exercise bike, family photo); the station and prop coordinates did not change. **Flight-deck hatch (no ladder):** the -Z wall is a pressure bulkhead with a round 0.75 m hatch on the aisle (centre cabin-local (0, 0.925, -4), sill 0.55 m, a step in front, grab rails at x ±0.72, stencil FLIGHT DECK above); behind it sits the Apollo cockpit when attached. `userData.bulkheadHatch` = `{ x: 0, y: 0.925, z: -4, r: 0.375 }`; `userData.openBulkheadHatch(t)` (0 closed … 1 open, the plug door swings into the cabin; closed when the cabin stands alone, e.g. Mars INTERIOR). The `pilotSeat` station is this hatch (going back to fly = through it to the real couch). `userData.ladderTopCabin` (0, 1.225, -3.7) is the eye just coming out of the hatch and `userData.ladderBottom` (0, 1.65, -3.2) the standing eye in the aisle in front of it, both facing into the cabin (+Z, `rotation.y = PI`); the names are kept for the post-landing egress. Walk box in `shipInterior.js`: the hatch and step at (0, -3.8), half 0.55 × 0.2. | **Zero-g (orbit cruise):** `userData.handrails` is `[{ a, b }]` (cabin-local `Vector3` ends of every grab rail: ceiling pairs under each cross rib, either side of the bulkhead hatch, in front of the wall stations, over the airlock); `userData.floatColliders` is `[{ min, max }]` (cabin-local boxes: floor, walls, chamfers, the bulkhead with its hatch opening, every station, rack and prop); `userData.zeroG(true)` makes the loose items (`userData.looseItems`: pen, checklist card, food packet, small bag) drift and tumble over the aisle, `zeroG(false)` drops them back to their places for Mars gravity. Dressing: foot loops, Velcro, bungees, CTB bags on the walls and clipped to rails, a sleeping bag on the front wall by the bunk, a laptop on a ceiling arm, checklists on bungees. The wall panels have real window openings (painted Mars views sit in front when the cabin stands alone); attached to the cockpit the cabin adds no `THREE.Light` (see `cockpit.userData.attachCabin`). `createCabin()` returns the pre-built cabin from warm-up the first time.
| `vfx:engineFlame` | Origin at the nozzle exit, plume down -Y, built for a 0.95 m nozzle (scale it for others). `userData.set({ throttle: 0..1, airDensity: 0..1, fuel: 'kerolox' \| 'methalox' \| 'hydrolox' })`. Sea-level plume has shock diamonds, vacuum balloons wider and fainter. Carries a point light. |
| `vfx:exhaust` | Origin at the nozzle exit, smoke falls down -Y. `userData.set({ throttle: 0..1, airDensity: 0..1 })`. Invisible in vacuum. |
| `vfx:entryPlasma` | Add it to the cockpit group (its coordinates). `userData.set({ intensity: 0..1 })`. Streaks outside the window, and an orange light inside. |
| `vfx:landingDust` | Origin on the ground under the engine, +Y up. `userData.set({ intensity: 0..1 })`. A sheet of dust up to about 40 m wide. |
| `planet:earth`, `planet:mars` | Radius 1, so set `planet.scale.setScalar(radius)`. To spin it, rotate `userData.surface`, not the group. Call `await assets.preload(['planet:earth', 'planet:mars'])` during loading so no placeholder shows. |
| `rover` | Crewed lunar-terrain-style Mars rover, a Blender model (`public/assets/models/rover.glb`, built by `scripts/blender/rover.py`; the old code-built rover is the fallback while the file loads or if it is missing): dark slate exoskeleton with a rounded roof slab, big glossy white faceted side block with the SPACEB&E MR-01 lettering and emblem, open glass-free two-seat cabin with a dash screen, three battery modules under each side, gold suspension brackets, wide woven balloon tyres on deep dark dish hubs, open rear bay with a solar roof, grille panel and a folded robotic arm, cyan LEDs. Real scale (about 3.2 m long, 2.0 m wide, 1.85 m to the roof, about 48 k triangles). The origin is on the ground at the centre of the wheelbase (2.29 m) and track (1.83 m), wheels rest on y = 0, forward is -Z, +X is right, and the root carries no transform. Four pivots named `wheelFL`, `wheelFR`, `wheelRL`, `wheelRR` at the wheel centres: set the pivot's `rotation.y` to steer and its first child's `rotation.x` to spin. The driver's eye is `userData.eye` = (-0.32, 1.45, -0.45). `userData.setDust(0..1)` adds Mars dust (each rover has its own materials). No lights. |
| `rover:lrv` | The traditional rover: NASA's Apollo Lunar Roving Vehicle, a Blender model (`public/assets/models/lrv.glb`, built by `scripts/blender/lrv.py`; the code-built version in `src/graphics/roverLrv.js` is the fallback): woven wire-mesh wheels with titanium chevrons, fibreglass fenders that steer with each wheel, beta-cloth battery covers, gold-foil relay unit, TV camera, umbrella dish, helical antenna, webbed seats, console and rear tool pallet, with baked dust and AO (about 35 k triangles, 2.7 MB). Same interface as `rover` (origin, size, the four wheel pivots with the spin node first, `setDust`); its seat is the default (-0.32, 1.48, 0.22). |
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
