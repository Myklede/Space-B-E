# Known issues in other roles' code

This file is a to-do list for the owners of each area, not a verdict. Found by Role 3 while playing the real game at 1280x800 on 2026-11-07, using real keyboard and mouse. Delete a line when it is fixed.

## Role 2 (Flight and Surface)

- `src/flight/hud/createFlightHUD.js` (the countdown overlay): during the LAUNCH countdown it sits over the stub panel and blocks clicks on "Skip to orbit". Enter still works.
- `src/flight/index.js` (`exit`, around line 476): the flight camera stays parented to the flight rig after LAUNCH ends, so `graphics.camera` keeps the ship's rotation. Anything that reuses `graphics.camera` afterwards (the ENDING screen in `src/story/index.js`) looks backwards: after a failed launch the player sees a black box (the cockpit's rear wall) instead of Earth. Removing the camera from the rig in `exit` fixes it.
- `src/flight/index.js` (LANDING entered by the debug jump): LANDING shows the same altitude, speed and "Entry: the heat shield takes the heat" hint as ENTRY (about 94 km), so the two are hard to tell apart.
- During ORBIT the player sees only stars in the default view, because the ship points along its orbit and Earth is below the window. Earth from orbit is one of the best views in the game, so consider starting the camera or the ship pitched down toward the limb.
- During ENTRY the player sees only stars. Mars is never in view in the default look direction, so the descent feels empty.
- `src/flight/flightAssist.js:78`: the orbit prompt "Fast enough to orbit" is drawn under the top-left stub panel in ORBIT, so it is half hidden.

## Role 4 (Story, Cruise and Knowledge)

- `src/story/index.js:25-27` (`earthView`): it assumes `graphics.camera` is a fresh camera. It is whatever camera the last state set, so ENDING after a flight can face the wrong way (see the Role 2 line above). Creating its own camera avoids it.
