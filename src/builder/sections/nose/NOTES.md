# Nose section: notes

## What is here (2026-11-07)

- 47 parts (32 kept, 15 new), 10 rows, 9 shapes, 7 kits (4 kept and extended, 3 new). Family `abort` (Escape system) is declared in `parts.json`.
- Rows, top to bottom: escape tower, nose cover / fairing, crew capsule, heat shield, trunk / adapter / kick stage (stack);
  abort engines, parachutes & floats, antennas, air-water-cooling-shelter, steering in space (side). The old "Cabin cooling"
  row was folded into the crew row (radiator) to keep the card short.
- Shapes: mercury, gemini, apollo, soyuz, big_cabin (Orion), crew_dragon, fairing_capsule (Vostok), bare_capsule, dawn_stack
  (Dawn on Delta II). Every crewed shape has a capsule and a heat shield. The three old shape ids are kept.
- New parts: les_tower_mercury, les_tower_apollo, las_soyuz (tower and fairing in one, as on Soyuz), las_orion, bpc_apollo,
  nosecap_dragon, nose_gemini_rr, nose_vonkarman_m, nose_biconic_m, fairing_composite_l, heat_shield_s, crew_trunk_m,
  chute_cluster_3, abort_pusher_pod, lioh_canisters.
- New kits: escape_tower (motor, jettison, steering), abort_pod (chamber, propellant), ablative_shield (thickness, gaps,
  ablator; used by heat_shield_s/m/l, same slot keys as `shield` so old saves keep their choices). Extended: capsule
  couches + ejection seats, chute canopy + conical ribbon. First options stay neutral.
- Existing part numbers (mass, cost, reliability, flags) are unchanged, so the presets are unchanged.

## Art decisions

- Capsules are drawn procedurally (the NASA esas/stardust models were wider than the stack and overhung the heat shield).
  Real blunt cones: Mk1 Mercury-like (dark shingles, recovery neck), Mk2 Gemini/Dragon-like (19° cone, white tiles), Mk3
  Apollo/Orion-like (24° cone, silver Mylar).
- Every capsule nose ends in the same 0.9 m docking ring (`NECK`), and everything that sits on a capsule (towers, covers,
  nose caps, fairing boat-tails) starts at that ring, so tall noses seat without gaps.
- A fairing (and the Soyuz escape fairing) with a capsule right under it (`entry.below`) is drawn as a full shroud: its lower part hangs down round the capsule, see-through and ignored by clicks, so the capsule and its equipment stay visible like a cut-away drawing. With no capsule under it, it ends in a boat-tail down to the docking ring. Covers with a part on top (`entry.above`) get a flat top and an attach ring.
- Side equipment hung on a capsule is pulled in to the cone's real surface and tilted with the wall (`seatFor` in art.js).
  The shared scene assumes a nearly cylindrical capsule (`taper` in designScene.js / hangarScene.js); the correction is
  the difference between the two, so it only applies to parts whose host is one of these capsules.
- The tower art follows the steering option: canards or an attitude-control ring appear when chosen.
- Low-gain whip, medium-gain horn and high-gain dish are procedural (the satkit models pointed their whips at the hull).
- Orion LAS, bottom to top: cap, abort motor (reverse-flow nozzles near its top), jettison motor, attitude-control ring, nose cone.

## Review fixes (2026-11-07)

- Covers (nose_* fairings, fairing_composite_l, nosecap_dragon, nose_gemini_rr) have a top node, so a tower added later stands above them.
- Escape towers and abort pods share `flags.bonusGroup: "abort"` (one escape system counts; a pod set is worth +2.5 %). Lighter, cheaper Apollo tower (1 t, $260k), Orion LAS (1.25 t, $330k), chute cluster ($85k), pods (130 kg, $80k); Apollo shape lost its floats.
- With the current code (cost includes the launch fee): Apollo, Orion, Soyuz and Dragon fly within $5M with no warnings on the Reliable body plus one more tank (large for Apollo/Orion), two srb_s and a gimbal ring ($4.78M, $4.85M, $4.39M, $4.64M). Their cons say so.
- Dawn stack is fairing > capsule > shield > payload attach fitting > Star 48 > spin table, as on Delta II.

## Requests to the lead

1. Re-bake the card pictures (`node src/builder/tools/bake-icons.mjs`): the baked PNGs of capsule_s/m/l, every nose_* fairing,
   heat_shield_m/l, heat_tiles_m, antenna_low, antenna_medium, antenna_high and the int:capsule:* / int:shield:* options still show the old art.
2. autoplace.js treats "no top node" as a nose; now that covers have a top node, `autoAttach(nose_pointed_m)` inserts the fairing above
   the engine (the builder test still passes because it only checks that something was placed). Suggest
   `isNose = def.family === 'fairing' || (def.nodes.includes('bottom') && !def.nodes.includes('top'))`. The design page uses addThroughRow, which is right.
3. Optional, cleaner than the correction in art.js: let designScene.js and hangarScene.js ask the section art for the real
   capsule surface (`surfaceRadius(def, yFrac, radius)` is exported from sections/nose/art.js) instead of the fixed
   `1 - 0.3 (yFrac - 0.4)` taper. If you do, delete `seatFor`'s `dx` (keep the tilt) in nose/art.js, or the parts move twice.
   The exploded pieces of side parts now follow the same seat (cached per part type and host radius).
4. Single-stage flight: escape towers are carried to Mars in the game (their text says so). If Role 2 ever drops parts in
   flight, `flags.abortTower` marks the parts to throw away about 2.5 minutes after launch.
5. Unused models now: stardust_capsule.glb, esas_crew_module.glb, voyager_antenna.glb, satkit_radio1.glb (see ASSETS.md; satkit_radio2.glb is still used by the body).
