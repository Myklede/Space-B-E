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
- **Status:** fixed in the design-page rebuild (chips are `min-width: max-content`, pad fee and pad thrust moved to a second line, the Mass chip moved into the side panel), dtri please verify

### About 63 MB downloads before the hangar is ready
- **For:** Role 1 · **From:** Role 3 (dtri) · **Found:** 2026-11-07 on dev 0722c4e · **Severity:** polish
- **Where:** `src/builder/bay/` loaders, `public/assets/nasa/`, `public/assets/polyhaven/`
- **Steps:** open `/` with the browser's Network tab, press START
- **Expected:** the bay usable within a few seconds on a demo Wi-Fi
- **Actual:** 38 MB load during the menu and 25 MB more on entering HANGAR (largest: `rassor.glb` 6.3 MB, `stardust_capsule.glb` 2.3 MB, `ingenuity.glb` 2 MB). On a fast local server it runs at 60 fps, but over about 50 Mbit/s that is 10 s or more. Separately, about 27 MB of NASA models are not referenced anywhere in `src/builder` (the "reserve" set: `eva_suit`, `habitat1/2`, `lro`, `iss_b`, `parker` and others), and every clone and build carries them.
- **Suggested fix:** load the decorative bay props after the hangar first draws, drop or shrink the largest ones, and remove the unused reserve models until a scene uses them
- **Status:** mostly fixed, dtri please verify: Poly Haven prop textures shrunk to 512 px (36 MB to 3 MB, `src/builder/tools/shrink-textures.mjs`); NASA models now download per part only when it is on the stand or inspected (`requestPartArt` in `bay/nasa.js`); card pictures are baked PNGs (1.9 MB for 148); RASSOR (6.3 MB) is no longer placed in the hall (a 57 kB stowed Mars Global Surveyor stands there); the `shuttle_door` model with missing textures is no longer used. Still open: the unused reserve GLBs are still in the repo (about 35 MB on disk, never downloaded by the game); Role 1 will delete them in a separate commit.

## Role 2: Flight & Astronaut

### Two new ShipSpec details the builder now sends (information, no action needed)
- **For:** Role 2 · **From:** Role 1 (Myklede) · **Found:** 2026-11-07 on dev 6fb54a4 · **Severity:** polish
- **Where:** `src/builder/stats.js` `computeShipSpec`
- **Steps:** presets, Workhorse, readiness poll, launch
- **Expected:** `stats.chuteCdA` is now set (300 for the main chute, 110 for a drogue, summed) and `shipParams` already reads it; strap-on solid motors are folded into the single stage: their thrust is in `stats.thrust`, their propellant in `stats.fuelMass`, their casings in `stats.dryMass`, and `stats.ispSL/ispVac` are thrust-weighted across liquid engines and solids (lower than the liquid engine alone). `spec.engines` still lists only the liquid engines.
- **Actual:** nothing wrong today; if you add staging later, `breakdown.boosterSpecs` in the builder has each solid's thrust, Isp, propellant and burn time ready for you
- **Status:** open

### The trajectory line is a thin vertical line down the cockpit window
- **For:** Role 2 · **From:** Role 3 (dtri) · **Found:** 2026-11-07 on dev 691ae19 · **Severity:** polish
- **Where:** `src/flight/index.js:134` (the cyan predicted path), in ORBIT and ENTRY
- **Steps:** `/?debug=1&state=ORBIT`, look ahead through the window
- **Expected:** a clear view of Earth's limb from the cockpit
- **Actual:** the ship now points along its motion, so the path lies in a plane through the camera and is seen edge-on: one thin cyan line from the top of the window to the bottom
- **Suggested fix:** hide the path in the cockpit view and keep it for the outside camera (C)
- **Status:** open

### LANDING under the parachute shows only flat sky
- **For:** Role 2 · **From:** Role 3 (dtri) · **Found:** 2026-11-07 on dev 691ae19 · **Severity:** polish
- **Where:** `src/flight/index.js` (LANDING view)
- **Steps:** `/?debug=1&state=LANDING`, wait 5 s
- **Expected:** some ground or horizon while descending from about 3 km
- **Actual:** the window shows a uniform butterscotch sky until touchdown
- **Suggested fix:** tilt the default look so the ground shows, or hint that C switches to the outside camera
- **Status:** open

## Role 3: Graphics, Audio & Core

### `rocketPart:` names with no match show as holograms in the flight views
- **For:** Role 3 · **From:** Role 1 (Myklede) · **Found:** 2026-11-07 on dev 6fb54a4 · **Severity:** polish
- **Where:** `src/graphics/assets.js` `createRocketPart` (`PART_MATCHERS`)
- **Steps:** build a ship with a guidance ring, interstage, truss, helium sphere or strap-on solid (presets, Workhorse), launch, press C for the outside camera
- **Expected:** a plain cylinder or box of about the right size for a part type the matcher does not know (the builder's `ShipSpec.parts` now carries types such as `avionics_ring_m`, `interstage_m`, `truss_m`, `centerbody_m`, `paf_m`, `helium_copv`, `srb_s`, `kick_motor_s`)
- **Actual:** `hologram('rocketPart:<id>')` for every unmatched id, so the outside view shows glowing placeholder boxes in the stack
- **Suggested fix:** add matchers for `ring|interstage|truss|centerbody|paf|spin` (a short cylinder, height from a `PART_HEIGHT` default of 1 m), `sphere|copv` (a small sphere) and `srb|kick_motor` (a slim cylinder with a cone); or accept a `height` hint in the id lookup
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

## Needs the whole team
