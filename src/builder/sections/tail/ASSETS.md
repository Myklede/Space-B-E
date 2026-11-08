# Tail section: assets

| Asset | Used by | Source | Licence |
|---|---|---|---|
| `public/assets/nasa/srb.glb` (Space Shuttle Solid Rocket Booster, already in the repo) | `srb_l` (Segmented solid booster), through its `model` field; `tail/art.js` wraps it with clamp struts | [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources) | NASA material, not subject to copyright. Credit: NASA. Already listed in CREDITS.md. |

No files were downloaded. Everything else in the tail is procedural three.js geometry written in `tail/art.js`.

No longer used by the tail: `shuttle_engines.glb` (was the engine art for `engine_s/m/l`) and `srb.glb` for `srb_s` /
`srb_m` (now drawn as GEM motors). Nothing was deleted.

## Wave 4 (2026-11-07)

- **No new files shipped yet.** The planned Blender models (`public/assets/models/builder/tail/<part id>.glb`) are
  listed in NOTES.md and will be credited here when they land.
- **Free models the modeller may cut:**
  - `redstone.glb` and `atlas.glb` (NASA 3D Resources, already in the repo, public domain): the Redstone tail unit and
    the Atlas booster section.
  - NASA's "Space Launch System Block 1" model (NASA 3D Resources, public domain): the SLS engine section.
- **Reference photos.** The research photos come from images.nasa.gov and stay outside the repo.
  - Most are NASA photos and in the public domain.
  - `electron_pad.jpg` (a Rocket Lab photo on the NASA site) and `proton_zvezda.jpg` (no credit given) are reference
    only: look and measure, never ship or trace.
