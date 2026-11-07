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

### The trajectory line is a thin vertical line down the cockpit window
- **For:** Role 2 · **From:** Role 3 (dtri) · **Found:** 2026-11-07 on dev 691ae19 · **Severity:** polish
- **Where:** `src/flight/index.js:134` (the cyan predicted path), in ORBIT and ENTRY
- **Steps:** `/?debug=1&state=ORBIT`, look ahead through the window
- **Expected:** a clear view of Earth's limb from the cockpit
- **Actual:** the ship now points along its motion, so the path lies in a plane through the camera and is seen edge-on: one thin cyan line from the top of the window to the bottom
- **Suggested fix:** hide the path in the cockpit view and keep it for the outside camera (C)
- **Status:** fixed in 7a06711, Role 3 (dtri) please verify

### LANDING under the parachute shows only flat sky
- **For:** Role 2 · **From:** Role 3 (dtri) · **Found:** 2026-11-07 on dev 691ae19 · **Severity:** polish
- **Where:** `src/flight/index.js` (LANDING view)
- **Steps:** `/?debug=1&state=LANDING`, wait 5 s
- **Expected:** some ground or horizon while descending from about 3 km
- **Actual:** the window shows a uniform butterscotch sky until touchdown
- **Suggested fix:** tilt the default look so the ground shows, or hint that C switches to the outside camera
- **Status:** fixed in 7a06711, Role 3 (dtri) please verify

### Switching camera views changes the light count
- **For:** Role 2 · **From:** Role 3 (dtri) · **Found:** 2026-11-07 on dev 6fb54a4 · **Severity:** polish
- **Where:** `src/flight/index.js:377-378` and `:422-423` (hiding `rocketRoot` or the cockpit per view)
- **Steps:** LAUNCH, press C
- **Expected:** no hitch
- **Actual:** hiding an object that holds lights changes the scene's light count, and three.js then recompiles every lit material (about 200 ms on an M5). Role 3's warm-up (`src/graphics/warmup.js`) now pre-compiles both views during PRELAUNCH, so it no longer hitches, but a new light or visibility rule in flight would bring it back.
- **Suggested fix:** keep lights in the scene and set their intensity to 0 instead of hiding them (that is what `src/graphics/vfx.js` does)
- **Status:** fixed in 7a06711, Role 3 (dtri) please verify

## Role 3: Graphics, Audio & Core

### `check:boot` refuses to run without Google Chrome at its default path
- **For:** Role 3 · **From:** Role 2 (Minh Vuong) · **Found:** 2026-11-07 on dev 691ae19 · **Severity:** bug
- **Where:** `scripts/check-boot.mjs:53` (`chromium.launch({ channel: 'chrome' })`)
- **Steps:** on Linux/WSL without Google Chrome installed (and no sudo to install it), run `npm run check` or push to `dev`
- **Expected:** every teammate can run the check that the pre-push hook requires
- **Actual:** `FAILED check:boot: Chrome could not start (... 'chrome' is not found at /opt/google/chrome/chrome)`, so the push is refused. Role 2 runs the unmodified check with Playwright's Chromium mounted at that path in a user namespace.
- **Suggested fix:** accept an `executablePath` from an env var (for example `CHROME_PATH`), or fall back to Playwright's bundled Chromium when the Chrome channel is missing
- **Status:** open

### `check:boot` needs a stub panel in every state, so real screens must keep one
- **For:** Role 3 · **From:** Role 2 (Minh Vuong) · **Found:** 2026-11-07 on dev 691ae19 · **Severity:** polish
- **Where:** `scripts/check-boot.mjs:90` (`page.locator('[data-stub]').count()`)
- **Steps:** replace a stub with a real screen that has no `[data-stub]` element, run `npm run check:boot`
- **Expected:** a real screen passes the boot walk
- **Actual:** `no stub screen is mounted in <STATE>`, so Role 2's real flight and surface screens still show a small "dev shortcut" stub panel, which must be gone for the demo
- **Suggested fix:** also accept a marker real screens can set (for example any element with `data-screen`), then each role drops its stub panel
- **Status:** open

### Rocket part `antenna_s` has no art and shows a hologram box
- **For:** Role 3 · **From:** Role 2 (Minh Vuong) · **Found:** 2026-11-07 on dev 691ae19 · **Severity:** polish
- **Where:** `src/graphics/assets.js` (`PARTS`, the id words are capsule, tank, engine, nose, fin, leg, heat)
- **Steps:** `/?debug=1&state=LAUNCH` with the Reliable mock, press C
- **Expected:** an antenna on top of the capsule
- **Actual:** a cyan hologram box, because `antenna_s` (in `src/core/mocks/ship.reliable.json`) matches no part word
- **Suggested fix:** add an antenna part, or drop `antenna_s` from the mocks if Role 1's builder supplies its own art through `assets.setRocketPartArt`
- **Status:** open

### Mock ships list a `deltaV` their masses can't give
- **For:** Role 3 · **From:** Role 2 (Minh Vuong) · **Found:** 2026-11-07 on dev 691ae19 · **Severity:** bug
- **Where:** `src/core/mocks/ship.reliable.json` (and the other mocks), `stats.deltaV`
- **Steps:** compare `stats.deltaV` with the rocket equation for the same file's `wetMass`, `dryMass`, `ispVac`
- **Expected:** `deltaV = ispVac · G0 · ln(wetMass / dryMass)` = 380 · 9.80665 · ln(42000 / 9000) ≈ 5741 m/s, which is what flight actually gets
- **Actual:** `deltaV: 8900`, so anything that reads it (the Δv budget, Go/No-Go) promises about 3 km/s the ship doesn't have
- **Suggested fix:** compute `deltaV` from the formula in the mocks (Role 1's builder should compute it the same way)
- **Status:** open

## Role 4: Story, Cruise & Knowledge

### ENDING reuses whatever camera the last state left
- **For:** Role 4 · **From:** Role 3 (dtri) · **Found:** 2026-11-07 on dev d728a61 · **Severity:** bug
- **Where:** `src/story/index.js:25-27` (`earthView`)
- **Steps:** `/?debug=1`, launch and fail, read the ENDING screen
- **Expected:** the ending's own view
- **Actual:** it assumes `graphics.camera` is fresh, but it is the camera the last state set. Role 2 now hands it back level, so it no longer shows a black wall, but the ending still shows the cockpit facing Earth from orbit after a failed launch.
- **Suggested fix:** create the ending's own camera and pass it to `graphics.setView`
- **Status:** open

### Reset money on the bankrupt ending
- **For:** Role 4 · **From:** Role 1 (in `docs/DECISIONS.md`) · **Found:** 2026-11-07 on dev 0722c4e · **Severity:** bug
- **Where:** the ENDING and REPORT flow for `endingId: 'bankrupt'`
- **Steps:** spend money until the hangar shows DECLARE BANKRUPTCY, press it
- **Expected:** the player can start over
- **Actual:** the contract resets money only when it is below $0, but bankruptcy is declared below $1.0M (`balance.insolvencyFloor`), so the player stays stuck
- **Suggested fix:** on `bankrupt`, reset money to `balance.startMoney`
- **Status:** open

### Cabin props open Guidebook entries that don't exist yet
- **For:** Role 4 · **From:** Role 2 (Minh Vuong) · **Found:** 2026-11-07 on dev 691ae19 · **Severity:** polish
- **Where:** `src/guidebook/` (the entries); Role 2 emits them from `src/surface/index.js` (`PROP_ENTRIES`)
- **Steps:** `/?debug=1&state=INTERIOR`, walk to the exercise bike, water recycler, food rack or family photo, press E
- **Expected:** a short real fact about crew life (spec §7.1, §13)
- **Actual:** `guidebook:open` arrives with `crew-exercise`, `crew-water`, `crew-food` or `family-photo`, and the stub shows only the id
- **Suggested fix:** create entries with those ids (or tell Role 2 the ids you prefer). Mars tasks can use `registerInteractable({ id, state: 'SURFACE', position, prompt, hold, onUse })`, see README "Role 2 APIs".
- **Status:** open

## Needs the whole team
