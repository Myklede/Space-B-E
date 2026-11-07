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

## Role 3: Graphics, Audio & Core

### New cockpit: please include the CUT-OFF, RETRO and ASSIST controls
- **For:** Role 3 · **From:** Role 2 (Minh Vuong) · **Found:** 2026-11-07 on dev 1fb9625 · **Severity:** polish
- **Where:** the new cockpit interior you are building (`src/graphics/cockpitParts.js`)
- **Steps:** in flight, look down at the hands while pressing X, holding Space or pressing F
- **Expected:** players who look down see what each input does: the stick and throttle already move through `setControls`; X (engine cut-off), Space (retro brake) and F (Flight Assist) should also have a visible control near the hands
- **Actual:** nothing moves for X, Space or F. Role 2 paused its own add-on switches so they don't clash with the new cockpit.
- **Suggested fix:** model a guarded red ENGINE CUT-OFF toggle, an amber RETRO button and a cyan ASSIST button near the hands, either animated by extending `setControls({ pitch, yaw, throttle, cutoff, brake, assist })` (Role 2 will pass the three booleans) or named (`cutoffSwitch`, `retroButton`, `assistButton`) so Role 2 can animate them. Your call.
- **Status:** fixed in a5c2f8c, Role 2 (Minh Vuong) please verify. Pass `cutoff`, `brake`, `assist` booleans to `setControls` every frame (omitted keys keep their last value); the guard lifts, the toggle flips, the buttons press in and light up.

### Core input has no mouse wheel (Role 2 needs it to zoom the outside camera)
- **For:** Role 3 · **From:** Role 2 (Minh Vuong) · **Found:** 2026-11-07 on dev 1fb9625 · **Severity:** polish
- **Where:** `src/core/input.js` (only `onPress`, `onEscape`, `mouseDelta`, `lockPointer`, `unlockPointer`, `clear`; no wheel)
- **Steps:** in flight press C (outside camera) and scroll the mouse wheel
- **Expected:** the wheel zooms the outside camera in and out (the player asked for the wheel, not keys)
- **Actual:** core input doesn't read the wheel, and Role 2 may not add its own listener
- **Suggested fix:** add `input.wheelDelta()` that returns the summed `deltaY` since the last frame and resets like `mouseDelta()` (call `preventDefault` on wheel over the game so the page doesn't scroll; normalise `deltaMode` lines/pages to pixels). Role 2's camera already calls `input.wheelDelta?.()`, so zoom starts working as soon as it exists.
- **Status:** fixed in a5c2f8c, Role 2 (Minh Vuong) please verify. Call `input.wheelDelta()` once per frame (pixels, positive = wheel down); it now exists.

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
- **Status:** fixed in a5c2f8c, Role 2 (Minh Vuong) please verify. Coordinate convention: points are screen units 0...1 of the plot area, x to the right and y UP, and `ship.heading` is in radians with 0 = pointing right and counter-clockwise positive; `setTrajectory(null)` hands the display back to telemetry.

### Phase 0 (strap-in): pressable cockpit buttons HATCH, CABIN, O2 and a new ARM ENGINE
- **For:** Role 3 · **From:** Role 2 + Role 4 (Minh Vuong; our team now also keeps Role 4) · **Found:** 2026-11-07 on dev 3d4fa59 · **Severity:** polish
- **Where:** the button row under the cockpit displays (`src/graphics/cockpitParts.js` / `interiors.js`): it already has O2, CABIN, HATCH (and FIRE, DUMP, DOCK, PARA, ENTRY); there is no ARM ENGINE button
- **Steps:** `/?debug=1&state=LAUNCH`, look down at the button row
- **Expected:** the agreed Phase 0 pre-launch checklist: before the countdown the player closes the HATCH, pressurises the CABIN, opens O2 and presses ARM ENGINE, each light turning from amber to green (red for ARMED), with a short press animation
- **Actual:** the buttons are static models without names or an API, and ARM ENGINE doesn't exist
- **Suggested fix:** name the buttons (`btn:hatch`, `btn:cabin`, `btn:o2`, `btn:arm`, …), add an ARM ENGINE button, and expose `cockpit.userData.setButton(id, state)` with `state` `'off' | 'amber' | 'green' | 'red'` plus a `press(id)` animation. Until then Role 2 shows the checklist on the HUD (keys 1–4) and calls `setButton?.()` so it lights up as soon as it exists.
- **Status:** fixed in a5c2f8c, Role 2 (Minh Vuong) please verify. Ids `hatch`, `cabin`, `o2`, `arm`, `fire`, `dump`, `rcs-a`, `rcs-b`, `main`, `apu`, `pwr`, `comms`, `dock`, `para`, `entry` (with or without `btn:`); `cockpit.userData.setButton(id, state)` and `press(id)` exist.

### Phase 0 sounds: harness click, hatch lock, cabin pressurise hiss, O2 flow, switch toggle
- **For:** Role 3 · **From:** Role 2 + Role 4 (Minh Vuong) · **Found:** 2026-11-07 on dev 3d4fa59 · **Severity:** polish
- **Where:** `src/audio/index.js` (today: alarm.master, ambience.mars, ambience.ship, engine.rumble, gonogo.tick, impact.small, radio.blip, radio.static, suit.breath, ui.click, ui.error, ui.hover, ui.snap)
- **Steps:** the Phase 0 strap-in and checklist
- **Expected:** `crew.harness` (buckle click), `cockpit.hatch` (heavy latch), `cockpit.pressurise` (2–3 s hiss), `suit.o2flow` (soft flow, loopable), `cockpit.switch` (toggle click)
- **Actual:** none of these exist; Role 2 falls back to `ui.click`
- **Suggested fix:** add the five ids (CC0 sounds, credit in CREDITS.md). Role 2 plays them by these names and falls back to `ui.click` while they are missing.
- **Status:** fixed in a5c2f8c, Role 2 (Minh Vuong) please verify. The five ids are synthesised in `src/audio/index.js`; `audio.play('suit.o2flow')` loops until `audio.stop('suit.o2flow')`.

## Role 4: Story, Cruise & Knowledge

### Reset money on the bankrupt ending
- **For:** Role 4 · **From:** Role 1 (in `docs/DECISIONS.md`) · **Found:** 2026-11-07 on dev 0722c4e · **Severity:** bug
- **Where:** the ENDING and REPORT flow for `endingId: 'bankrupt'`
- **Steps:** spend money until the hangar shows DECLARE BANKRUPTCY, press it
- **Expected:** the player can start over
- **Actual:** the contract resets money only when it is below $0, but bankruptcy is declared below $1.0M (`balance.insolvencyFloor`), so the player stays stuck
- **Suggested fix:** on `bankrupt`, reset money to `balance.startMoney`
- **Status:** fixed on `role4-story` (`endingId: 'bankrupt'` or money below $0 resets to `balance.startMoney` and returns to HANGAR), Role 1 please verify

## Needs the whole team

### Allow PRELAUNCH → HANGAR (and LAUNCH → HANGAR before liftoff) so the player can SCRUB a launch
- **For:** all four roles · **From:** Role 2 + Role 4 (Minh Vuong) · **Found:** 2026-11-07 on dev 3d4fa59 · **Severity:** decision
- **Where:** `src/core/contract.js` `TRANSITIONS` (`PRELAUNCH: ['LAUNCH']`, `LAUNCH: ['ORBIT']`)
- **Steps:** the agreed Phase 0: the launch director polls the stations ("Booster? GO. Guidance? GO. Weather? NO-GO: 2 °C, seals not rated"), then asks "Flight crew, are you GO?"
- **Expected:** the player can answer GO or **SCRUB** (postpone). SCRUB costs a scrub fee and returns to the hangar to fix the ship, like a real launch scrub ("NASA has scrubbed hundreds of launches"). Going on despite a NO-GO is how the Challenger lesson happens.
- **Actual:** the contract has no way back from PRELAUNCH or LAUNCH to HANGAR except through ENDING, and there is no scrub ending
- **Suggested fix:** add `'HANGAR'` to `PRELAUNCH` and `LAUNCH` in `TRANSITIONS` (Role 2 only requests it before liftoff), and a `scrubFee` (proposed $100,000) in `src/core/balance.json`. Role 2/4 will show the SCRUB choice only when the contract allows it, so nothing breaks before the team agrees.
- **Status:** on hold (dtri, 2026-11-07): not now; keep the current flow, revisit later

