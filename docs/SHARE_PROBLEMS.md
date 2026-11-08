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

### Flight switches still read F ASSIST and Space RETRO, but the new controls use F = MANUAL and Space = LOCK
- **For:** Role 3 · **From:** Role 2 (Minh Vuong) · **Found:** 2026-11-07 on dev f3deb43 · **Severity:** polish
- **Where:** `src/graphics/cockpitParts.js` (the flight switches near the hands: `retroButton`/`retroCap` and `assistButton`/`assistCap`, and their silk-screen labels)
- **Steps:** `/?debug=1&state=LAUNCH`, look down at the switches by the hands
- **Expected:** the new flight controls (design change by Role 2, no contract change): the flight computer flies by default; during three short manual windows (ascent gravity turn, Mars entry, final landing) the player presses **F** to take MANUAL control, steers with the mouse on the centre display, and presses **Space** to LOCK guidance back to the computer. W/S/A/D, Q/E and the Space retro brake go away. X (ENGINE CUT-OFF) stays.
- **Actual:** the labels still say F ASSIST and Space RETRO
- **Suggested fix:** relabel the cyan button `F  MANUAL` and the amber button `SPACE  LOCK`; keep the part names and `setControls({ pitch, yaw, throttle, cutoff, brake, assist })` exactly as they are. Role 2 will pass `assist: true` while the player has manual control (lamp lit = MANUAL) and `brake: true` for about 0.3 s when Space locks guidance (button presses in). The stick and throttle keep moving through `pitch`/`yaw`/`throttle` (the computer's inputs, or the player's during a manual window), so the gloves need no change.
- **Status:** open

### Optional: let the centre display draw the manual-control aim (○ circle on a + target)
- **For:** Role 3 · **From:** Role 2 (Minh Vuong) · **Found:** 2026-11-07 on dev f3deb43 · **Severity:** polish
- **Where:** `src/graphics/interiors.js` (the steering display, `cockpit.userData.setTrajectory`, mesh named `centreDisplay`)
- **Steps:** (design request, nothing to reproduce yet) during a manual window the camera zooms into the centre display
- **Expected:** the display shows a target `+`, the player's aim circle `○`, an accuracy bar, the seconds left and a `LOCK READY · SPACE` cue, drawn on the screen itself like the trajectory plot
- **Actual:** the display can only draw the trajectory, so Role 2 will first draw the ○/+ as an HTML overlay placed over the `centreDisplay` mesh. Please keep the mesh name `centreDisplay` stable so the overlay and the camera zoom can find it.
- **Suggested fix:** optional, only if you have time: add `cockpit.userData.setAim({ target: { x, y }, aim: { x, y }, radius, accuracy, timeLeft, lockReady, label })` or `setAim(null)`, with x, y in screen units 0–1 and y UP (the same convention as `setTrajectory`), `radius` in the same units, `accuracy` 0–1, `timeLeft` in seconds, `label` a short title such as `ASCENT · GRAVITY TURN`. While an aim is set it draws on top of the trajectory plot. Role 2 calls `setAim?.()` and drops its HTML overlay as soon as the function exists. The existing stable-API agreement for `setControls` and `setTrajectory` (the comment at the top of the steering display code) still holds.
- **Status:** open

### Optional: core input has no mouse buttons (manual control wants a click to LOCK)
- **For:** Role 3 · **From:** Role 2 (Minh Vuong) · **Found:** 2026-11-07 on dev f3deb43 · **Severity:** polish
- **Where:** `src/core/input.js` (has `isDown`, `onPress`, `onEscape`, `mouseDelta`, `wheelDelta`, `lockPointer`, `unlockPointer`, `isLocked`, `clear`; no mouse buttons)
- **Steps:** during a manual window, click the left mouse button
- **Expected:** the player asked to lock guidance with a mouse click as well as Space
- **Actual:** core input doesn't read mouse buttons, and Role 2 may not add its own listener, so Role 2 uses Space only
- **Suggested fix:** optional: treat mouse buttons as codes in the existing API, e.g. `input.isDown('Mouse0')` and `input.onPress('Mouse0', fn)` (`Mouse2` = right button), fired from `mousedown`/`mouseup` only while the pointer is locked, so the click that locks the pointer doesn't count. Role 2 will register `onPress('Mouse0', …)` next to Space, so it starts working as soon as core supports it.
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

