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
- **Status:** open

### Check your Mars positions on the new terrain
- **For:** Role 2 · **From:** Role 3 (dtri) · **Found:** 2026-11-07 on dev 8e9af5c · **Severity:** polish
- **Where:** `getTerrainHeight` (`src/graphics/terrain.js`) now has about 480 craters, a river channel, buttes and dunes; anything you place on Mars by coordinates
- **Steps:** `/?debug=1&state=SURFACE`, walk or drive to each task / interactable / prop you place outside the cabin
- **Expected:** every position stays on walkable ground (Role 3 kept the landing zone flat within 60 m and crater-free within 150 m, and measured the lander, hatch, rover parking and the Halcyon wreck)
- **Actual:** Role 3 only measured the positions it could find. The Halcyon wreck at (430, -320) now sits on a levelled 40 m bench (the delta scarp under it was 24°); anything else you placed far out may now be in a crater or on a bank.
- **Suggested fix:** if a position is bad, move it (or tell Role 3 and we'll flatten a spot like the wreck bench)
- **Status:** open

## Role 3: Graphics, Audio & Core

### Reliable mock has no armor, so one debris hit ends the demo run
- **For:** Role 3 · **From:** Role 2 (Minh Vuong) · **Found:** 2026-11-07 on dev c0b99d6 · **Severity:** polish
- **Where:** `src/core/mocks/ship.reliable.json:20` (`armorHits: 0`). Role 2 reads it at `src/flight/FlightController.js:101` and `:130`, and spawns the once-per-mission debris at `src/flight/index.js:381` ("Orbital debris encounter").
- **Steps:** `/?debug=1&state=ORBIT`, wait about 20 s for "ORBITAL DEBRIS AHEAD" (or press B), don't dodge. The HUD shows `ARMOR 0` and the hit ends the flight.
- **Expected:** the "Reliable" preset is the guaranteed-success demo ship (spec §5.1: "guaranteed success if flown sensibly"). One absorbed hit would keep the live demo safe (the Thin Skin mock already has `armorHits: 1`).
- **Actual:** Reliable has `armorHits: 0`, so a single debris hit during the pitch ends the run.
- **Suggested fix:** set `armorHits` to 1 in `ship.reliable.json` (and its cost/mass if Role 1's builder recomputes them). Role 2 can't edit `src/core/`.
- **Status:** fixed in ae246cd, Role 2 (Minh Vuong) please verify

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

### Cabin props open Guidebook entries that don't exist yet
- **For:** Role 4 · **From:** Role 2 (Minh Vuong) · **Found:** 2026-11-07 on dev 691ae19 · **Severity:** polish
- **Where:** `src/guidebook/` (the entries); Role 2 emits them from `src/surface/index.js` (`PROP_ENTRIES`)
- **Steps:** `/?debug=1&state=INTERIOR`, walk to the exercise bike, water recycler, food rack or family photo, press E
- **Expected:** a short real fact about crew life (spec §7.1, §13)
- **Actual:** `guidebook:open` arrives with `crew-exercise`, `crew-water`, `crew-food` or `family-photo`, and the stub shows only the id
- **Suggested fix:** create entries with those ids (or tell Role 2 the ids you prefer). Mars tasks can use `registerInteractable({ id, state: 'SURFACE', position, prompt, hold, onUse })`, see README "Role 2 APIs".
- **Status:** fixed on `role4-story` (all four ids are in `src/guidebook/entries.json` and show as a card; Q closes it), Role 2 please verify

### Pale Blue Dot text lives in Role 2's code; Role 4 owns the wording
- **For:** Role 4 · **From:** Role 2 (Minh Vuong) · **Found:** 2026-11-07 on dev c0b99d6 (feature in Role 2's push after f93ee5a) · **Severity:** polish
- **Where:** `src/surface/index.js:38-39` (exported constants `EARTH_HINT` and `EARTH_CAPTION`)
- **Steps:** `/?debug=1&state=SURFACE`, press `N` (debug: jump to dusk), look toward the low bluish dot in the sunset sky and hold `Z` (helmet zoom). The caption appears once per mission.
- **Expected:** spec §11 "Pale Blue Dot moment" and §13 say Role 4 writes HQ/narrative lines.
- **Actual:** Role 2 built the moment (sol clock: the Sun sinks to dusk over about 6 min of EVA, Earth appears as the evening star drawn by Role 3's sky, helmet zoom, caption) with placeholder wording. Hint: "Look for Earth: low in the sky, hold Z to zoom". Caption: "EARTH · about 225 million km away" / "Everyone you have ever loved is on that dot."
- **Suggested fix:** Role 4 tells Role 2 the final wording (or a story data key to read it from), and Role 2 updates the constants. No contract change needed. Optionally Role 4 may also want an HQ radio line at that moment.
- **Status:** open

## Needs the whole team

### How the game should use the two rovers
- **For:** all four roles · **From:** Role 3 (dtri) · **Found:** 2026-11-07 on dev 8e9af5c · **Severity:** decision
- **Where:** `assets.get('rover')` is the futuristic space-SUV rover (Blender model, the default Role 2 drives today); `assets.get('rover:lrv')` is a realistic Apollo LRV with the same interface (same size, wheel pivots, `setDust`; its seat is the default eye). Both drive with Role 2's `RoverController` unchanged.
- **Steps:** see both in `/sandbox/role3.html?view=rover` and `?view=roverLrv`
- **Expected:** a team decision on how the LRV appears in the game
- **Actual:** only `rover` is used. Options: (1) the player chooses a rover before the EVA (Role 1 or Role 2 UI); (2) both are parked by the lander and the player drives whichever they walk to (Role 2); (3) the LRV is a relic of an earlier mission parked near the Halcyon-1 wreck, still drivable, with a story log (Role 2 places it, Role 4 writes the log).
- **Suggested fix:** pick one; no contract change is needed for any of them
- **Status:** open
