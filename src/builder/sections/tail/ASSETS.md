# Tail section: assets

| Asset | Used by | Source | Licence |
|---|---|---|---|
| `public/assets/nasa/srb.glb` (Space Shuttle Solid Rocket Booster, already in the repo) | `srb_l` (Segmented solid booster), through its `model` field; `tail/art.js` wraps it with clamp struts | [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources) | NASA material, not subject to copyright. Credit: NASA. Already listed in CREDITS.md. |

No files were downloaded. Everything else in the tail is procedural three.js geometry written in `tail/art.js`.

No longer used by the tail: `shuttle_engines.glb` (was the engine art for `engine_s/m/l`) and `srb.glb` for `srb_s` /
`srb_m` (now drawn as GEM motors). Nothing was deleted.
