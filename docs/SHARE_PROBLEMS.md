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
- **Status:** fixed in da944ac, Role 3 (dtri) please verify (below 1320 px the second lines hide and stay in each value's tooltip; checked at 1100, 1280 and 1440 px)

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

### `stats.reliability` never matters in flight
- **For:** Role 2 · **From:** Role 1 (Myklede) · **Found:** 2026-11-07 on dev 3d4fa59 · **Severity:** decision
- **Where:** `src/flight/` (nothing reads `spec.stats.reliability`; only the builder's Go/No-Go uses it for `LOW_RELIABILITY`)
- **Steps:** `/?debug=1`, build Cold Morning (reliability under 80 %) and Reliable (about 91 %), launch both
- **Expected:** TEAM_PROMPT §5.3: "cheap parts have a higher hidden failure chance (shown as a reliability %)". The builder now spends real design on it: cheap seals, materials, engine clusters (`r^n`, or engine-out), pad equipment and escape towers all move the number
- **Actual:** both ships fly exactly the same; the reliability the player paid for never shows up
- **Suggested fix:** one roll per flight phase, e.g. a chance of `(1 − reliability) / 3` at liftoff, max-Q and staging/entry, that triggers an existing failure (`rud`, or an engine-out that cuts thrust); `spec.engines.length > 1` could mean the ship survives losing one engine. Needs agreement on which ending a random failure uses
- **Status:** open
- **More (2026-11-08, Role 1):** dev's c3e586e now runs the ascent guide on Earth only. Role 1 will re-check Workhorse's Mars entry with it and drop the propulsion stop-gap once it holds.
- **More (2026-11-07, Role 1):** the builder now flies an as-built ship (src/builder/asBuilt.js: factory spread and rare defects already lower thrust, Isp or propellant, set `heatShieldDamaged` or raise `ascentCdA`). What only flight can do, proposed for the whole team: (1) a per-phase roll from `stats.reliability` (for example 50 % of 1 − reliability on ascent, 10 % cruise, 25 % entry, 15 % landing) that emits `part_failure` and the matching ending (no new names); (2) skin limits as ShipSpec extras `stats.maxQKPa` and `stats.maxSkinTempC` (from `hull.js` limits, ignored if absent) so an overloaded skin can break up on the climb instead of the fixed 40 kPa.

### The launch scene's tower and pad dwarf the ship: use Role 1's launch pad and skin
- **For:** Role 2 · **From:** Role 1 (Myklede) · **Found:** 2026-11-07 on dev 3d4fa59 · **Severity:** bug (the whole team agreed on the fix: the pad is part of the ship Role 1 builds and pays for)
- **Where:** `src/flight/` LAUNCH / PRELAUNCH scene (the orange tower, the concrete pad and the two white tanks), outside camera (C)
- **Steps:** `/?debug=1&state=LAUNCH`, press C
- **Expected:** a ship that fills its pad like a real one: towers about 1.1–1.3 × the ship's height, the mount about 1.5–2 × its diameter, and the launch complex the player chose in the hangar (LC-39A, SLC-40, Starbase, Gagarin's Start… with its trench, water, clamps and tower)
- **Actual:** the ship is a thin column hidden inside a tower several times its width; the hardstand and tanks are huge next to it
- **Suggested fix:** Role 1 registers two assets from the builder's `init` (through the public `assets.register`, no contract change):
  - `assets.get('builder:launchPad')` → the chosen complex sized to the confirmed ship: origin on the ground at the launch mount's centre, the ship's axis on y; `userData.top` is the height (m) where the ship's base sits; the tower stands on +x. Drop your tower and tanks and place the ship's base at `userData.top`.
  - `assets.get('builder:rocketSkin')` → the outer skin (fairings, skirts, interstage cones that make the stack one smooth body) in ShipSpec coordinates (stack base at y = 0, axis at x = z = 0); add it to the rocket group with the parts. Empty group when the ship has no skin.
  - Role 1 also calls `assets.setRocketPartArt`, so `rocketPart:<type>` returns the hangar's own models (Role 3's row in the README, as dtri asked). Equipment that rides inside the skin returns an empty object.
- **Status:** open (Role 1 ships the two assets next; Role 2 places them)

### ascentGuide fires one-frame burns on a lofted Mars entry
- **For:** Role 2 · **From:** Role 1 (Myklede, wave-5 propulsion agent) · **Found:** 2026-11-08 on dev 66d5e5d · **Severity:** bug
- **Where:** `src/flight/autopilot.js` (`ascentGuide(fc)` is used on any planet) together with the coast ↔ entry phase switch in `FlightController._computePhase`
- **Steps:** autopilot on Workhorse from `STARTS.marsEntry` (FPA −22.8°, 5,389 kg fuel). The lofted entry flattens at about 33.6–33.7 km (vertical speed about 0, Mach about 5).
- **Expected:** no engine burn while the ship coasts through the upper atmosphere on entry
- **Actual:**
  - The phase flips coast ↔ entry every few metres, and each flip makes `ascentGuide()` return 'circularise'. The autopilot commands full throttle for one frame, then cuts.
  - That is one engine start each time: 9 starts at 4× warp, 17 at 2×, 35 at 1×. The count depends on the frame rate.
  - The pulses add about 20 m/s prograde, and that is what keeps Workhorse from blacking out later. With a guard (`fc.planetId === 'earth' ? ascentGuide(fc) : null`, as `steering.js` already does), Workhorse blacks out on entry instead.
  - Now that engines have real ignition counts (wave 5, TEA-TEB cartridges), those pulses would use up the landing relights.
- **Suggested fix:** guard ascentGuide to Earth (or to the ascent phase) and retune Workhorse's Mars entry corridor or the entry autopilot so it no longer relies on the pulses.
  - Until then, Role 1's propulsion effects keep ignitions unlimited for a Mars controller above 3 km and count only starts below 3 km (marked as a stop-gap in `src/flight/effects/propulsion.js`).
- **Status:** open

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

### The demo cabin is Apollo: `ShipSpec.stats.cabin` and an Apollo preset are ready (information)
- **For:** Role 3 · **From:** Role 1 (Myklede) · **Found:** 2026-11-08 · **Severity:** polish
- **Where:** `getShip().stats.cabin` (`src/builder/stats.js`); the preset is `src/builder/data/presets/apollo.json` (More → Preset vehicles → Apollo)
- **Steps:** open the hangar, More → Preset vehicles → Apollo, then the readiness poll and launch; in INTERIOR read `getShip().stats.cabin`
- **Expected:** the walkable interior matches the Apollo command module:
  - 3 couches;
  - 5 windows (2 forward, 2 side, 1 in the hatch);
  - the side hatch;
  - the docking tunnel overhead.

  The window and hatch pieces of the outside model are on branch `role1-cabins-for-role3` (`public/assets/models/builder/nose/capsule_apollo.glb`: `slot_windows*`, `slot_hatch*`).
- **Actual:** nothing wrong. `stats.cabin` for the preset reads `{ type: 'capsule_apollo', windows: 'small', hatch: 'outward', docking: 'probe_drogue', couches: 'shock', atmosphere: 'pad_mix', suits: 'pressure', volumeM3: 6.17 }`.
- **Suggested fix:**
  - Use `stats.cabin.type === 'capsule_apollo'` to pick the Apollo interior, and keep your current cabin for every other type.
  - Real references: the Smithsonian CC0 scan at https://3d.si.edu (Apollo 11 command module, interior included) and NASA's Apollo Operations Handbook.
  - Keep all seven `STATIONS`.

### Flight deck: a gloved hand should reach out and press each pre-launch checklist button (HATCH, CABIN, O2, ARM ENGINE)
- **For:** Role 3 · **From:** Role 2 (Minh Vuong) · **Found:** 2026-11-08 on dev 9db4cd6 · **Severity:** polish
- **Where:** `src/graphics/flightDeck.js` (and the procedural fallback in `cockpitParts.js`): a new `cockpit.userData.reach(id)`; the gloves themselves are the entry "Flight deck: no gloved hands on the stick and throttle" above
- **Steps:** `/?debug=1&state=LAUNCH`, the Phase 0 checklist: look at the HATCH button (screen-centre reticle) and click
- **Expected:** the player's design (replaces keys 1–4): when the player clicks a checklist button, the pilot's gloved hand reaches out from below the view, flips/presses that button, and returns, about 1 s in total (reach ~0.45 s, press, return ~0.4 s); right hand for buttons right of the centre, left hand for the others. The button's own press-in and lamp change happen at the moment the glove touches it
- **Actual:** Role 2 now does the aim + click and the lamps (in progress on role2-flight, coming to dev soon), but there is no hand, so the button just changes by itself
- **Suggested fix:** add `cockpit.userData.reach(id) → seconds` (ids `hatch`, `cabin`, `o2`, `arm`, any `btn:` id is a bonus): it plays the glove reach/press/return animation itself, calls its own `press(id)` at contact, and returns the seconds until contact. Role 2 already calls `reach?.(id)` and delays its lamp/sound by the returned seconds; when `reach` is missing it presses at once, so nothing breaks in between. Ease-in/out, the glove may also release the stick during the reach and go back to it

- **Status:** open

### Cabin (INTERIOR): it doesn't yet feel like a place an astronaut could live in for months
- **For:** Role 3 · **From:** Role 2 (Minh Vuong) · **Found:** 2026-11-08 on dev 482d9b6 · **Severity:** polish (design request: the HEART of the game, TEAM_PROMPT §7.1 and §11)
- **Where:** `src/graphics/cabin.js` (4 × 8 × 2.6 m, cabin-local x −2…2, z −4…4); Role 2 reads `userData.stations`, `userData.props`, the ladder points, and now supports walk boxes (`src/surface/WalkController.js`, `CABIN_BOXES` in `src/surface/shipInterior.js`)
- **Steps:** `/?debug=1&state=INTERIOR`, walk around and imagine living there for 500+ sols (7 months out, ~1.5 years on Mars, 7 months back)
- **Expected:** written as the astronaut who lives here. Every real habitat (ISS, the NASA Mars transit and surface habitat studies) is organised around the same daily needs. I need each of these to exist, readable at a glance, in this order of priority:
  - **P1. Sleep station** (replaces the open bunk): a private booth about 1 × 1 × 2 m with a door or curtain, a sleeping bag strapped to the wall, a reading lamp, a small laptop, a fan grille (on ISS, exhaled CO₂ pools around a sleeping head without airflow), padded walls, and my **family photo** and a child's drawing pinned inside. This is where the family messages hit hardest.
  - **P1. Galley**: a fold-down table with two stools (we have 0.38 g on Mars), a food warmer, a hot/cold water dispenser with a rehydration needle for food pouches, labelled food containers (one marked "BONUS FOOD": ISS crews get personal favourites), a trash compactor.
  - **P1. Hygiene compartment**: a closed cubicle with a toilet (fan suction, a urine hose and funnel: it works in any gravity), no-rinse shampoo, wet wipes, a towel on a bungee, a small mirror. Next to it, the **water recovery** rack ("today's coffee is yesterday's coffee": ISS recycles about 98 % of its water).
  - **P1. Exercise corner**: a treadmill with a shoulder/waist harness and a resistance machine (bar on cables). ISS crews exercise about 2 hours every day to keep bone and muscle; in 0.38 g it is still needed.
  - **P1. Life support (ECLSS) rack**, the thing that keeps me alive: CO₂ scrubber, oxygen generator (electrolysis), air filters and fans, a status panel with green lamps that turn amber/red with the existing `setAlarm`, plus a **fire extinguisher and a breathing mask** mounted beside it, clearly signposted (the Apollo 1 lesson).
  - **P1. Dust zone by the airlock**: a floor grate, a brush/vacuum and a boot rack between the airlock and the suit locker (Mars dust is fine, sharp and carries perchlorates: it must not reach the living area).
  - **P2. Science bench**: a sealed glovebox next to the sample storage, a microscope, and a small sample freezer (−80 °C) with a temperature readout.
  - **P2. Plant growth unit**: a small box of lettuce under pink-purple (red + blue) LEDs. The ISS Veggie unit grew lettuce that crews ate in 2015; green life matters a lot when everything else is metal.
  - **P2. Medical kit**: a white locker with a red cross (kit, defibrillator, small ultrasound).
  - **P2. Storm shelter**: the sleep station walled by water bags/tanks, marked "STORM SHELTER" (water stops solar-particle radiation; it ties to the cruise solar storm).
  - **P2. Lighting with a day/night cycle**: cool white "morning" light, warm amber "evening" light and dim red night lights along the floor (ISS switched to LEDs that do this to protect crew sleep). A tiny `userData.setLightMode('day' | 'evening' | 'night')` would let Role 2 drive it from the sol clock.
  - **P3. Personal touches**: a wall calendar counting sols with crossed-off days, a "DAYS TO HOME" counter, a Halcyon-1 mission patch (original design) pinned in memory of the lost crew, a small music player, stowage bags (cargo transfer bags with labels and Velcro), yellow handrails, emergency egress arrows and glow strips on the floor.
  - **Layout rules**: a clear walkway of at least 0.8 m down the middle from the ladder to the airlock; noisy and wet things (exercise, hygiene, ECLSS) away from the sleep station; the window over the comms console kept (that's where Earth shows at dusk).
- **Actual:** today the cabin has the seven stations and a family photo, decorative racks and the new ladder; there is nowhere to sleep privately, eat, wash, exercise or see what keeps the air breathable
- **Suggested fix:** build the areas above in `cabin.js` (your art direction and exact placement). For the gameplay hooks, please:
  - keep the seven contract stations (`pilotSeat`, `o2Station`, `suitLocker`, `commsConsole`, `sampleStorage`, `airlock`, `bunk`; the bunk becomes the sleep station) in `userData.stations`;
  - put each new area as a named prop in `userData.props` with its interaction point (`sleepStation`, `galley`, `hygiene`, `waterRecovery`, `treadmill`, `resistanceDevice`, `eclss`, `fireExtinguisher`, `dustZone`, `glovebox`, `sampleFreezer`, `plantGrowth`, `medKit`, `stormShelter`, `calendar`, `familyPhoto`): Role 2 will show a short real fact for each (no contract change needed, props are local notices);
  - export the furniture footprints as `userData.walkBoxes = [{ x, z, hx, hz }]` (cabin-local, half sizes) so the player can't walk through them (Role 2 already supports boxes);
  - optional: `userData.setLightMode(mode)` as above.
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

### Role 1 is adding part effects in flight, on Mars and in the cruise (information: all four agreed)
- **For:** all four roles · **From:** Role 1 (Myklede) · **Found:** 2026-11-08 on dev 66d5e5d · **Severity:** decision (agreed by all four, told by Myklede)
- **Where:**
  - New files: `src/builder/traits/` (what each chosen part does, computed into `ShipSpec.stats.traits`) and `src/flight/effects/` (one file per group).
  - Hooks in `src/flight/FlightController.js` (marked "part effects").
  - Wave-5 agents will also edit `src/surface/oxygen.js`, `astronaut.js`, `RoverController.js`, `rovers.js`, `src/cruise/index.js` and `src/missions/` comms.
- **Steps:** build a cheap ship and an expensive one with the same Δv and fly both
- **Expected:** each part's real characteristics show in play, with real physics and trade-offs, not "dearer is better":
  - engine throttle depth, restarts, steering, and an engine failing in flight by its reliability;
  - a cheap pad holding the ship back at liftoff;
  - skin strength at max-Q, heating, and what a debris hit does to titanium versus aluminium;
  - heat shield capacity;
  - suit and cabin oxygen in kilograms, CO₂ scrubbing and the radiation dose behind the shelter;
  - leg touchdown limits, power for the rovers and antenna data rates.

  The game shows no new messages in flight; a flight analysis in the hangar explains afterwards.
- **Actual:** today most part choices change only the builder's numbers
- **Suggested fix:** nothing to do for you.
  - Every new field is optional, so a missing trait means "as before".
  - No contract name changes: failures use existing `ENDINGS` and `flight:failed`.
  - The flight's record is kept in `save.partEffects`.
  - Role 1 runs Role 2's and Role 4's tests before each commit and will list every touched file here when it lands on dev. Please tell Myklede if a hook gets in your way.
- **Files Role 1 changed outside `src/builder` (please read before you edit them):**
  - **Role 2:**
    - `src/flight/FlightController.js`: the hooks marked "part effects"; the engine cut at touchdown; `part_failure` in `BUS_FLIGHT_EVENTS`; telemetry `thrust` and `twr` through the thrust hook; `armorUsed` on `debris_hit`.
    - `src/flight/autopilot.js`:
      - the hoverslam block (`SLAM`) for engines with a throttle floor;
      - `avoidDebris()`: dodge if it can burn, otherwise nose into the stream; it also runs on the coast after MECO;
      - `throttleTarget = 0` once landed;
      - the status line "Debris ahead: nose into the stream".
    - `src/flight/index.js`: the record setter, and the debris callout "Debris strike!" when no armour was used.
    - `src/flight/objectives.js`: the touchdown line shows the chosen legs' limit.
    - `src/flight/steering.js`: prediction copies use the quiet effects.
    - `src/flight/effects/*` (new).
    - `src/surface/oxygen.js`, `astronaut.js`, `shipInterior.js`: oxygen in kg, nitrogen, prebreathe by cabin air.
    - `src/surface/RoverController.js`, `rovers.js`: battery from the ship's power, charging at the lander.
  - **Role 4:**
    - `src/cruise/index.js`, `data.json` and the new `life.js`: storm dose by shielding, a scrubber failure with backups, the cabin leak, the tank emergency venting real kg, `co2` in mmHg in telemetry.
    - `src/missions/index.js`: the log upload takes time by antenna; with no working antenna, the existing `beagle` ending. The hint line shows "Uploading … %".
  - **Tests:** every Role 2 and Role 4 test passes; new tests in `src/flight/tests/effects-*.test.mjs`, `src/surface/tests/lifeEffects.test.mjs` and `src/cruise/tests/life.test.mjs`.
  - **Contract:** no new events, states, endings, tasks or stations.
- **Notes for Role 2:**
  - The HUD throttle shows the commanded throttle, while the pad holds real thrust at 92 % for the first seconds. If you want, show `thrust / thrustNow(alt)`.
  - `corridor.js` still uses `TUNING.heatLimit` rather than `fc._heatLimit()`, which now follows the chosen shield.
- **Note for Role 4:** telemetry `co2` is in mmHg (NASA's long-mission limit is about 3 mmHg; Apollo 13 reached about 15). The report mock's `peakCo2: 0.6` looks like a percentage.
- **Status:** done on `role1-builder` (wave 5); please tell Myklede if a hook gets in your way

### Allow PRELAUNCH → HANGAR (and LAUNCH → HANGAR before liftoff) so the player can SCRUB a launch
- **For:** all four roles · **From:** Role 2 + Role 4 (Minh Vuong) · **Found:** 2026-11-07 on dev 3d4fa59 · **Severity:** decision
- **Where:** `src/core/contract.js` `TRANSITIONS` (`PRELAUNCH: ['LAUNCH']`, `LAUNCH: ['ORBIT']`)
- **Steps:** the agreed Phase 0: the launch director polls the stations ("Booster? GO. Guidance? GO. Weather? NO-GO: 2 °C, seals not rated"), then asks "Flight crew, are you GO?"
- **Expected:** the player can answer GO or **SCRUB** (postpone). SCRUB costs a scrub fee and returns to the hangar to fix the ship, like a real launch scrub ("NASA has scrubbed hundreds of launches"). Going on despite a NO-GO is how the Challenger lesson happens.
- **Actual:** the contract has no way back from PRELAUNCH or LAUNCH to HANGAR except through ENDING, and there is no scrub ending
- **Suggested fix:** add `'HANGAR'` to `PRELAUNCH` and `LAUNCH` in `TRANSITIONS` (Role 2 only requests it before liftoff), and a `scrubFee` (proposed $100,000) in `src/core/balance.json`. Role 2/4 will show the SCRUB choice only when the contract allows it, so nothing breaks before the team agrees.
- **Status:** on hold (dtri, 2026-11-07): not now; keep the current flow, revisit later

