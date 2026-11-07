# Known issues in other roles' code

This file is a to-do list for the owners of each area, not a verdict. Found by Role 3 while playing the real game at 1280x800 on 2026-11-07, using real keyboard and mouse. Delete a line when it is fixed.

## Role 2 (Flight and Surface)

The six items found on 2026-11-07 at night were fixed in 691ae19 and checked again by playing at 8:30am: Skip to orbit clicks during the countdown, Earth fills the window in ORBIT, Mars in ENTRY, LANDING starts low, and ENDING after a failed launch no longer shows a black wall. New ones from that play-through:

- `src/flight/index.js:134` (the cyan trajectory line): now that ORBIT and ENTRY point the nose along the motion, the predicted path lies in a plane through the camera, so from the cockpit it is seen edge-on as one thin vertical line down the middle of the window. Hiding it in the cockpit view (keeping it for the outside camera) would fix it.
- LANDING from about 3 km, under the parachute: the window shows only flat butterscotch sky, with no ground or horizon, until touchdown. Optional: tilt the default look so the ground shows, or hint that C switches to the outside camera.

## Role 4 (Story, Cruise and Knowledge)

- `src/story/index.js:25-27` (`earthView`): it assumes `graphics.camera` is a fresh camera. It is whatever camera the last state set, so ENDING after a flight can face the wrong way (see the Role 2 line above). Creating its own camera avoids it.
