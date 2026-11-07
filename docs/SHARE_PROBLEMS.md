# Shared problems

Problems one role finds in another role's folders. Instead of editing someone else's code, write the problem here; the owner reads their section every time they start work. Everyone may edit this file.

## How to use this file (AI agents: follow exactly)

**When you start work,** read your role's section below. Fix `open` items marked `blocker` or `bug` before starting new features.

**To report a problem:**

1. Check that it is in another role's folders (see "Roles" in `README.md`). If it is in your own folders, just fix it.
2. Reproduce it once on the latest `dev` and write down the exact steps.
3. Search this file. If it is already here, add a line to that entry instead of a new one.
4. Add one entry at the **end of the owner's section**, using the template below. One problem per entry.
5. Commit only this file, with the message `share-problem: <title>`, and push it the usual way (`git merge origin/dev`, `npm run check`, `git push origin HEAD:dev`). Then tell your human in one line.

**To fix a problem reported to you:** fix it in your own folders, then change its Status to `fixed in <commit>, <reporter> please verify`. Don't delete the entry yourself.

**To check a fix you reported:** try it again on the latest `dev`. If it is gone, delete the entry. If not, set Status back to `open` and add what still happens.

**Never edit another role's code to fix their problem,** even when the fix is one line. Put the fix under "Suggested fix" instead.

**If a fix needs a contract change** (a new event, state, ending, task, station or ShipSpec field), use severity `decision`, put it under "Needs the whole team", and tell your human: all four people must agree.

**On a merge conflict in this file,** keep both sides. Entries never replace each other.

### Template

Copy this block. Keep each line short and factual. Don't commit screenshots.

```markdown
### <What is wrong, in a few words. Not the fix.>
- **For:** Role N · **From:** Role N (name) · **Found:** YYYY-MM-DD on dev <short commit> · **Severity:** blocker | bug | polish | decision
- **Where:** `path/to/file.js:line` (function, or the state where it shows)
- **Steps:** how to see it, for example `/?debug=1&state=ORBIT`, then look ahead
- **Expected:** what should happen (cite the spec section or contract name if one applies)
- **Actual:** what happens instead, with the exact console error if there is one
- **Suggested fix:** optional, one or two lines
- **Status:** open
```

**Severity:**

- `blocker`: crashes, stops the game loop, or blocks another role's work.
- `bug`: wrong behaviour, but the game goes on.
- `polish`: looks, sounds or feels wrong.
- `decision`: needs a contract or design change all four agree on.

## Role 1: Rocket Builder

### Numbers overflow their boxes in the design page's top bar
- **For:** Role 1 · **From:** Role 3 (dtri) · **Found:** 2026-11-07 on dev 0722c4e · **Severity:** polish
- **Where:** `src/builder/designPage.js` and `src/builder/builder.css` (the stats bar)
- **Steps:** window 1280x800, HANGAR, open a design desk (`window.__game.builder.openStation('integration')` with `?debug=1`)
- **Expected:** each value inside its own box
- **Actual:** "$2.97M +$150k" runs into FUNDS, "5,400" into TWR, and "943 kN" into "88 %" under RELIABILITY
- **Suggested fix:** let the boxes grow to fit (`min-width: max-content`), or put the pad fee and thrust on a second line
- **Status:** open

### About 63 MB downloads before the hangar is ready
- **For:** Role 1 · **From:** Role 3 (dtri) · **Found:** 2026-11-07 on dev 0722c4e · **Severity:** polish
- **Where:** `src/builder/bay/` loaders, `public/assets/nasa/`, `public/assets/polyhaven/`
- **Steps:** open `/` with the browser's Network tab, press START
- **Expected:** the bay usable within a few seconds on a demo Wi-Fi
- **Actual:** 38 MB load during the menu and 25 MB more on entering HANGAR (largest: `rassor.glb` 6.3 MB, `stardust_capsule.glb` 2.3 MB, `ingenuity.glb` 2 MB). On a fast local server it runs at 60 fps, but over about 50 Mbit/s that is 10 s or more. Separately, about 27 MB of NASA models are not referenced anywhere in `src/builder` (the "reserve" set: `eva_suit`, `habitat1/2`, `lro`, `iss_b`, `parker` and others), and every clone and build carries them.
- **Suggested fix:** load the decorative bay props after the hangar first draws, drop or shrink the largest ones, and remove the unused reserve models until a scene uses them
- **Status:** open

### The rocket on the pad does not look like the one built in the hangar
- **For:** Role 1 · **From:** Role 3 (dtri) · **Found:** 2026-11-07 on dev 6fb54a4 · **Severity:** polish
- **Where:** `src/builder/bay/partArt.js` (hangar art) vs `src/flight/index.js` `buildRocket` (uses `assets.get('rocketPart:<type>')`)
- **Steps:** build a ship, launch, press C for the outside camera
- **Expected:** the same NASA hardware and procedural parts the player chose in the bay
- **Actual:** flight draws Role 3's simpler built-in parts
- **Suggested fix:** Role 3 added `assets.setRocketPartArt(fn)` (README, "Role 3 APIs you can use now"). Call it once from your init with a function that returns your art for a part type, or `null` when the model is not loaded yet. Follow the origin rules in that README row: axial parts start at their base and set `userData.height`; radial parts start at the attachment point with +x outward, so bake in the offsets `hangarScene.js` adds around line 60. Also, built-in `rocketPart:` objects now share geometry and materials, so `disposeObject` on them only frees GPU buffers that are uploaded again; skip disposing objects that came from `assets.get`.
- **Status:** open

## Role 2: Flight & Astronaut

### The cockpit's joystick and throttle lever never move
- **For:** Role 2 · **From:** Role 3 (dtri) · **Found:** 2026-11-07 on dev 8e9af5c · **Severity:** polish
- **Where:** `src/flight/index.js`, where the cockpit is created (`assets.get('cockpit')`) and the flight update loop
- **Steps:** `/?debug=1&state=LAUNCH`, look down (the gloved hands sit on a joystick at the right and a throttle lever at the left), then throttle up with Q and pitch with W/S
- **Expected:** the stick tilts with pitch/yaw input and the throttle lever slides with the throttle
- **Actual:** they stay still, because nothing calls the new cockpit API
- **Suggested fix:** every frame call `cockpit.userData.setControls({ pitch: state.pitch, yaw: state.yaw, throttle: fc.throttle })` (pitch and yaw -1…1, W = nose down = -1; throttle 0…1; motion is smoothed inside the cockpit). See the `cockpit` row in README "Role 3 APIs".
- **Status:** fixed in 057a5f2 (setControls every flight frame, LAUNCH/ORBIT/ENTRY/LANDING), Role 3 (dtri) please verify

### Check your Mars positions on the new terrain
- **For:** Role 2 · **From:** Role 3 (dtri) · **Found:** 2026-11-07 on dev 8e9af5c · **Severity:** polish
- **Where:** `getTerrainHeight` (`src/graphics/terrain.js`) now has about 480 craters, a river channel, buttes and dunes; anything you place on Mars by coordinates
- **Steps:** `/?debug=1&state=SURFACE`, walk or drive to each task / interactable / prop you place outside the cabin
- **Expected:** every position stays on walkable ground (Role 3 kept the landing zone flat within 60 m and crater-free within 150 m, and measured the lander, hatch, rover parking and the Halcyon wreck)
- **Actual:** Role 3 only measured the positions it could find. The Halcyon wreck at (430, -320) now sits on a levelled 40 m bench (the delta scarp under it was 24°); anything else you placed far out may now be in a crater or on a bank.
- **Suggested fix:** if a position is bad, move it (or tell Role 3 and we'll flatten a spot like the wreck bench)
- **Status:** fixed in 057a5f2: Role 2 measured every position it places (lander, hatch, walker start, LRV parking (6.5, 7), MR-01 parking (-7, 7): slopes ≤ 0.7°, nothing had to move) and drove 1.3 km over the new craters and dunes with no rollover; Role 4's tasks and wreck measured too (max 10° at the hematite sample). Role 3 (dtri) please verify

## Role 3: Graphics, Audio & Core

### Two light glints sit fixed in the middle of the flight view
- **For:** Role 3 · **From:** Role 2 (Minh Vuong) · **Found:** 2026-11-07 on dev 1fb9625 · **Severity:** bug
- **Where:** the cockpit's window glass (a transparent `MeshPhysicalMaterial`, roughness 0.06, opacity 0.05) and its two point lights, `cabinLight` (white, at (0, 0.45, 0.05)) and the unnamed cyan one at (0, -0.6, -0.6)
- **Steps:** `/?debug=1&state=ORBIT` (or LAUNCH), look straight ahead
- **Expected:** a clear view through the window
- **Actual:** the glass reflects both lights as two bright star-like dots: a white one just above the horizon at screen centre and a cyan one at the bottom centre of the window. They move with the camera, so players read them as stars stuck to the view. Hiding the glass removes both (checked in the browser).
- **Suggested fix:** on the window glass set `specularIntensity: 0` (and `clearcoat: 0`), or raise its roughness to about 0.35, in the new cockpit too
- **Status:** open

### New cockpit: please include the CUT-OFF, RETRO and ASSIST controls
- **For:** Role 3 · **From:** Role 2 (Minh Vuong) · **Found:** 2026-11-07 on dev 1fb9625 · **Severity:** polish
- **Where:** the new cockpit interior you are building (`src/graphics/cockpitParts.js`)
- **Steps:** in flight, look down at the hands while pressing X, holding Space or pressing F
- **Expected:** players who look down see what each input does: the stick and throttle already move through `setControls`; X (engine cut-off), Space (retro brake) and F (Flight Assist) should also have a visible control near the hands
- **Actual:** nothing moves for X, Space or F. Role 2 paused its own add-on switches so they don't clash with the new cockpit.
- **Suggested fix:** model a guarded red ENGINE CUT-OFF toggle, an amber RETRO button and a cyan ASSIST button near the hands, either animated by extending `setControls({ pitch, yaw, throttle, cutoff, brake, assist })` (Role 2 will pass the three booleans) or named (`cutoffSwitch`, `retroButton`, `assistButton`) so Role 2 can animate them. Your call.
- **Status:** open

### Core input has no mouse wheel (Role 2 needs it to zoom the outside camera)
- **For:** Role 3 · **From:** Role 2 (Minh Vuong) · **Found:** 2026-11-07 on dev 1fb9625 · **Severity:** polish
- **Where:** `src/core/input.js` (only `onPress`, `onEscape`, `mouseDelta`, `lockPointer`, `unlockPointer`, `clear`; no wheel)
- **Steps:** in flight press C (outside camera) and scroll the mouse wheel
- **Expected:** the wheel zooms the outside camera in and out (the player asked for the wheel, not keys)
- **Actual:** core input doesn't read the wheel, and Role 2 may not add its own listener
- **Suggested fix:** add `input.wheelDelta()` that returns the summed `deltaY` since the last frame and resets like `mouseDelta()` (call `preventDefault` on wheel over the game so the page doesn't scroll; normalise `deltaMode` lines/pages to pixels). Role 2's camera already calls `input.wheelDelta?.()`, so zoom starts working as soon as it exists.
- **Status:** open

### Steering moves to the cockpit trajectory screen: keep its API stable in every cockpit update
- **For:** Role 3 · **From:** Role 2 (Minh Vuong) · **Found:** 2026-11-07 on dev a439097 · **Severity:** bug (flight control will depend on it)
- **Where:** `src/graphics/interiors.js`, `drawTrajectory` (the centre display of the new cockpit), and the `cockpit` row in README "Role 3 APIs"
- **Steps:** (design agreement, nothing to reproduce yet)
- **Expected:** the player's design: the centre HUD markers go away and the player **flies by the cockpit screen**, keeping the ship icon on a dashed reference trajectory. The centre display shows (1) the planned trajectory as a dashed line, (2) a predicted line ("where you go if you hold these inputs"), (3) the ship icon, (4) one short key hint, e.g. "Low: hold S ▲" or "✓ On track". Role 2 computes all of it from the physics (ascent profile, orbit, entry and landing) and sends it a few times per second.
- **Actual:** the centre display draws an altitude curve from `flight:telemetry`; it can't show a planned or predicted line or a hint yet, so Role 2 can't wire the steering to it
- **Suggested fix:**
  - Add `cockpit.userData.setTrajectory({ planned: [[x, y], …], predicted: [[x, y], …], ship: { x, y, heading }, view: 'side' | 'top', hint: { text, level: 'ok' | 'warn' } })` (points in screen units 0–1, or metres plus a scale; tell Role 2 which you prefer and Role 2 will match it). Calling it with `null` hands the display back to your own telemetry drawing.
  - **Treat it like `setControls`: a stable API.** Every future cockpit redesign must keep `setTrajectory` and `setControls` working with the same arguments, keep the trajectory display large and readable from the default pilot view (dashed and predicted lines distinguishable, hint text legible at 1280×720), and document both in the README `cockpit` row. If an argument must change, write it here first so Role 2 updates the steering in the same push.
  - Role 2 will keep a fallback: if `setTrajectory` is missing, the old HUD markers come back, so a cockpit without it never leaves the player unable to fly.
- **Status:** open

## Role 4: Story, Cruise & Knowledge

### ENDING reuses whatever camera the last state left
- **For:** Role 4 · **From:** Role 3 (dtri) · **Found:** 2026-11-07 on dev d728a61 · **Severity:** bug
- **Where:** `src/story/index.js:25-27` (`earthView`)
- **Steps:** `/?debug=1`, launch and fail, read the ENDING screen
- **Expected:** the ending's own view
- **Actual:** it assumes `graphics.camera` is fresh, but it is the camera the last state set. Role 2 now hands it back level, so it no longer shows a black wall, but the ending still shows the cockpit facing Earth from orbit after a failed launch.
- **Suggested fix:** create the ending's own camera and pass it to `graphics.setView`
- **Status:** fixed on `role4-story` (story, cruise and report each use their own camera; the ending view hides the cockpit), Role 3 please verify

### Reset money on the bankrupt ending
- **For:** Role 4 · **From:** Role 1 (in `docs/DECISIONS.md`) · **Found:** 2026-11-07 on dev 0722c4e · **Severity:** bug
- **Where:** the ENDING and REPORT flow for `endingId: 'bankrupt'`
- **Steps:** spend money until the hangar shows DECLARE BANKRUPTCY, press it
- **Expected:** the player can start over
- **Actual:** the contract resets money only when it is below $0, but bankruptcy is declared below $1.0M (`balance.insolvencyFloor`), so the player stays stuck
- **Suggested fix:** on `bankrupt`, reset money to `balance.startMoney`
- **Status:** fixed on `role4-story` (`endingId: 'bankrupt'` or money below $0 resets to `balance.startMoney` and returns to HANGAR), Role 1 please verify

## Needs the whole team

### How the game should use the two rovers
- **For:** all four roles · **From:** Role 3 (dtri) · **Found:** 2026-11-07 on dev 8e9af5c · **Severity:** decision
- **Where:** `assets.get('rover')` is the futuristic space-SUV rover (Blender model, the default Role 2 drives today); `assets.get('rover:lrv')` is a realistic Apollo LRV with the same interface (same size, wheel pivots, `setDust`; its seat is the default eye). Both drive with Role 2's `RoverController` unchanged.
- **Steps:** see both in `/sandbox/role3.html?view=rover` and `?view=roverLrv`
- **Expected:** a team decision on how the LRV appears in the game
- **Actual:** only `rover` is used. Options: (1) the player chooses a rover before the EVA (Role 1 or Role 2 UI); (2) both are parked by the lander and the player drives whichever they walk to (Role 2); (3) the LRV is a relic of an earlier mission parked near the Halcyon-1 wreck, still drivable, with a story log (Role 2 places it, Role 4 writes the log).
- **Suggested fix:** pick one; no contract change is needed for any of them
- **Decision (Role 2's human, Minh Vuong, 2026-11-07):** both rovers are parked by the lander. The **Apollo LRV** (`rover:lrv`) is drivable from the start; the **MR-01** (`rover`) is locked until Mars Exploration reaches 50 % (then a calm unlock notice), with concept specs (about 20 km/h, 30 kWh) so unlocking it matters. Implemented by Role 2 in f2ca02c; `?debug=1` + U unlocks it.
- **Status:** decided, built in f2ca02c; the team please confirm or object
