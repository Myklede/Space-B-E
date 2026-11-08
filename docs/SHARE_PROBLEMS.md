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

### After a Mars touchdown the flight computer lifts off again
- **For:** Role 2 · **From:** Role 3 (dtri) · **Found:** 2026-11-08 on dev 0b0c0bd · **Severity:** bug
- **Where:** `src/flight/` (the flight computer / phase logic after `fc.landed`)
- **Steps:** `/?debug=1&state=LANDING`, let the computer fly the descent (no input), touch down, then wait without pressing E
- **Expected:** the ship stays landed (engine off) until the player presses E to stand up (LANDING → INTERIOR)
- **Actual:** about 20 s after touchdown the HUD switches to "FLIGHT / ASCENT · Gravity turn: tipping 14° toward the horizon", the ship climbs (5.8 km at 415 m/s, then 27 km), FUEL LOW, then NO FUEL; the state stays LANDING and the objective still says "Touch down under 3 m/s". At touchdown the cockpit camera also tilts sideways onto the FLIGHT MODE panel. No console errors. Screenshots: `~/SpaceB-E-tools/shots/land-*.jpg` on dtri's machine.
- **Suggested fix:** once `fc.landed` is true, keep the flight computer idle (throttle 0, no ascent program) until the state changes; probably related to "F toggles manual control any time" (1aba680)
- **Status:** fixed in c3e586e, Role 3 (dtri) please verify. Root cause: the autopilot's last hover throttle (~10 %) stayed on after touchdown, Mars gravity let it lift off, and the Earth ascent program then took over. Now touchdown shuts the engine down (throttle 0, not lit), a landed ship ignores throttle commands, the ascent program only runs on Earth before landing, and a landed ship levels itself upright on its legs within ~1 s (that should also cure the sideways camera; please check).

### The cabin ladder has no collider
- **For:** Role 2 · **From:** Role 3 (dtri) · **Found:** 2026-11-08 on dev 59866c8 · **Severity:** polish
- **Where:** `src/surface/shipInterior.js` (the INTERIOR walk colliders); the ladder is in `src/graphics/cabin.js`
- **Steps:** `/?debug=1&state=INTERIOR`, walk to the ladder on the left of the aisle (cabin-local x -0.68, z 2.3)
- **Expected:** the player bumps into the ladder like any other cabin furniture
- **Actual:** the player walks through it
- **Suggested fix:** add a box collider about 0.5 m (x) by 0.2 m (z) around cabin-local (-0.68, 2.3), floor to ceiling
- **Status:** fixed in 3b12c3e, Role 3 (dtri) please verify. A 0.5 m × 0.2 m box collider (floor to ceiling) at cabin-local (-0.68, 2.3); the walker now supports upright boxes.

## Role 3: Graphics, Audio & Core

### Flight deck: no gloved hands on the stick and throttle
- **For:** Role 3 · **From:** Role 2 (Minh Vuong) · **Found:** 2026-11-08 on dev 0b0c0bd · **Severity:** polish
- **Where:** `public/assets/models/flightdeck.glb` / `src/graphics/flightDeck.js` (`stick`, `throttle` parts moved by `setControls`)
- **Steps:** `/?debug=1&state=LAUNCH`, look down at the stick and throttle during the ascent, or press F
- **Expected:** like the procedural cockpit: the pilot's gloved right hand on the stick and left hand on the throttle, moving with them. The stick now moves with the flight computer's corrections and the player's mouse aim (`setControls` pitch/yaw), the throttle with the computer's throttle, so the hands show who is flying
- **Actual:** the stick and throttle move, but no hands or sleeves are on them
- **Suggested fix:** parent the suit gloves (and short sleeves) from the procedural cockpit, or new ones, to the `stick` and `throttle` nodes so they follow `setControls`
- **Status:** open

### New spaceship interior: the post-landing egress needs an aft hatch and a ladder down to the mid-deck
- **For:** Role 3 · **From:** Role 2 (Minh Vuong) · **Found:** 2026-11-08 on dev 0b0c0bd · **Severity:** polish (for the new spaceship design)
- **Where:** the new spaceship design (flight deck GLB + the INTERIOR cabin)
- **Steps:** `/?debug=1&state=LANDING`, then `__role2flight.egress()` in the console (preview; off in normal play until the new interior exists)
- **Expected:** the player's approved scene after touchdown: press E, harness off, stand up in 0.38 g, turn to the aft hatch behind the seats, walk 1–1.5 m to it, the hatch opens, look down a ladder, fade; INTERIOR then starts with the camera climbing down that ladder through a ceiling hatch into the cabin (mid-deck)
- **Actual:** the flight deck has an `aft` node but no openable hatch or ladder, and the cabin has no ceiling hatch or ladder where the climb-down ends
- **Suggested fix:** in the new design: a floor or aft hatch on the flight deck named `aftHatch` (pivot set so it can swing open; optional `userData.openHatch(t 0…1)`), an empty `ladderTop` at the top of the ladder (standing eye position, facing the hatch), and in the cabin a ceiling hatch + ladder with an empty `ladderBottom` (standing eye position at the foot of the ladder, facing into the cabin). Role 2 will drive the camera between these points, so exact sizes are your call.
- **Status:** cabin side fixed in 71375b2: ceiling hatch + ladder on the left of the aisle; `cabin.userData.ladderBottom` (cabin-local (-0.68, 1.65, 1.68), facing -Z) and `userData.ladderTopCabin` ((-0.68, 2.48, 2.04), facing +Z); children of the cabin group, so use getWorldPosition. No collider for the ladder yet (src/surface/shipInterior.js is Role 2's). The cockpit side (aftHatch, ladderTop) comes with the new capsule cockpits. Role 2 (Minh Vuong) please verify the cabin part. **How to verify (cabin part):** `/?debug=1&state=INTERIOR`, place the camera at `cabin.userData.ladderTopCabin` and `ladderBottom` (world positions via getWorldPosition) for the climb-down.

### Flight deck: a gloved hand should reach out and press each pre-launch checklist button (HATCH, CABIN, O2, ARM ENGINE)
- **For:** Role 3 · **From:** Role 2 (Minh Vuong) · **Found:** 2026-11-08 on dev 9db4cd6 · **Severity:** polish
- **Where:** `src/graphics/flightDeck.js` (and the procedural fallback in `cockpitParts.js`): a new `cockpit.userData.reach(id)`; the gloves themselves are the entry "Flight deck: no gloved hands on the stick and throttle" above
- **Steps:** `/?debug=1&state=LAUNCH`, the Phase 0 checklist: look at the HATCH button (screen-centre reticle) and click
- **Expected:** the player's design (replaces keys 1–4): when the player clicks a checklist button, the pilot's gloved hand reaches out from below the view, flips/presses that button, and returns, about 1 s in total (reach ~0.45 s, press, return ~0.4 s); right hand for buttons right of the centre, left hand for the others. The button's own press-in and lamp change happen at the moment the glove touches it
- **Actual:** Role 2 now does the aim + click and the lamps (in progress on role2-flight, coming to dev soon), but there is no hand, so the button just changes by itself
- **Suggested fix:** add `cockpit.userData.reach(id) → seconds` (ids `hatch`, `cabin`, `o2`, `arm`, any `btn:` id is a bonus): it plays the glove reach/press/return animation itself, calls its own `press(id)` at contact, and returns the seconds until contact. Role 2 already calls `reach?.(id)` and delays its lamp/sound by the returned seconds; when `reach` is missing it presses at once, so nothing breaks in between. Ease-in/out, the glove may also release the stick during the reach and go back to it
- **Status:** open

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

