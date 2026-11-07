# Launch pad section: notes

Owner: the pad section agent (Role 1). Files: `section.json` (sites, windows, equipment), `art.js` (the pad under the
vehicle in the design studio). `parts.json` and `internals.json` stay empty: the pad is not part of the vehicle.

## Data rules kept

- Site `cape` stays first, with windows `cold` (2 °C, free), `mild` (18 °C, $150k) and `warm` (27 °C, $300k): the
  presets and `data/launch.json` use these ids and fees, so preset costs and the Cold Morning story do not move.
- Every equipment's first option is free and neutral (fee 0, reliability 0). The first equipment (`mount`) ends with a
  paid option that adds reliability, which the builder test uses.
- Reliability: each option at most +1.0 %, the best of everything together +5.0 %
  (mount 0.8, tower 0.7, clamps 0.9, water 0.7, lightning 0.5, crew escape 0.5, loading 0.4, weather 0.5).
- Equipment fees: $25k to $200k per option, $910k for the most expensive pad.

## Sites and windows: what a choice is worth in the game

A site only changes the fees and the launch temperature, and the temperature only matters below 5 °C with cheap
seals. So the sites are priced against the Cape, where a warm launch means waiting ($150k):

- **Cape**: free and cold (2 °C) tomorrow, or $150k / $300k to wait for 18 / 27 °C.
- **Warm sites** (Vandenberg, Starbase, Kourou, Wenchang, Tanegashima, Mahia): every window is 8 °C or warmer and the
  soonest costs $120k–150k in total (the site fee), about the same as waiting at the Cape; later windows add $30k / $60k.
- **Cold sites** (Baikonur, Plesetsk): no site fee, and every window this week is below freezing: worth it only with
  cold-rated seals (then as good as the Cape's free window). Their notes say why nobody waits months for spring:
  Mars lines up with Earth for only a few weeks every 26 months.
- Every "Tomorrow" is a January day (winter in the north, summer at Mahia).
- Each note ends with one plain "In the game: …" sentence; the Earth-spin speeds at the Cape and Kourou say
  "(the game does not count it)".
- Some windows carry an extra `real` field (Challenger, InSight, JWST): the window list shows it as
  "Real-world reference".

## Art

- Everything is procedural three.js, merged into one mesh per material (8 to 16 meshes, up to about 70k vertices for
  the most equipped pad; under about 20 ms to build). The page redraws it when the site, window, equipment or the
  ship's size changes.
- Layout: in the pad's own frame the service tower stands on +x; the whole pad is turned so the tower sits at 67.5°
  (between the 45° legs and the 90° fins, away from side boosters at 0°/180°).
- The ship is read from `layout` (`shipModel` in art.js):
  - the tower, strongback and crew towers step back from any side part reaching their way (fins, legs, boosters,
    solar wings: reach estimated from each part's side area and height);
  - each swing arm and strongback clamp is moved onto the flank of a part (not a joint, an engine or a nose tip),
    out of the way of side parts, and reaches that part's own hull radius;
  - the crew arm is at the capsule's mid-height; the white room stands off the widest hull beside it and a boxed
    seal reaches in to the capsule wall (capsule radius from the nose section's exported `surfaceRadius`, read only);
  - hold-down clamps grip the bottom of the lowest part above the engines, shifted ±11° if a side part comes down there.
- Empty stand: swing arms and the white room are drawn swung back beside the tower.
- Gear at the ship's base (clamps, umbilical mast, tail service masts, rainbirds, water feed) sits at 22.5° + k·45°.
- `top` (where the vehicle stands): slab 0.45 m, raised mount 4.2 m, trench table 3.5 m, mobile launcher 6.3 m.
- Ground per site: a soft canvas-textured disc (sand, golden grass, beach, rain forest, steppe, taiga, green
  pasture), with a snow cover when the chosen window is below 0 °C. Textures are cached (at most 18).
- NASA models: `mobile_launcher.glb` / `mobile_launcher_pad.glb` were looked at and not used. The base's exhaust opening
  is off-centre (Shuttle/SLS layout), its umbilical arms are sized for an 8.4 m core and would not reach a 2.5 m ship,
  and the texture is very dark next to the procedural pad. `gantry.glb` has 724 meshes (too heavy for every frame).

## Requests to the lead

- Done by the lead: the pad redraws on size / window changes and gets `layout`; the old range panel is gone.
- None open.
