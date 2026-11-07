# Nose section: assets

No new files were downloaded for the nose. Everything new is procedural three.js geometry in `art.js`
(capsules, heat shields, fairings, escape towers, covers, trunk, parachute cluster, abort pods, LiOH rack, high-gain dish).

## NASA models still used by nose parts (already in `public/assets/nasa/`, public domain, NASA 3D Resources)

Source: https://github.com/nasa/NASA-3D-Resources (NASA, public domain).

| Part | Model file |
|---|---|
| relay_sat | ladee.glb |
| rcs_pack | shuttle_rcs.glb |
| reaction_wheel | satkit_body3.glb |
| o2_bottle, o2_tank_l | satkit_body1.glb |
| co2_scrubber, water_recycler | oru.glb |
| radiation_shelter | docking_system.glb |
| radiator | satkit_wings1.glb |

## Models the nose no longer uses

These were the art of capsule_s / capsule_m / capsule_l and antenna_low / medium / high; the nose now draws those parts itself.
No other file in `src/` references them, so they can join the unused-model cleanup (or stay for later use):

- stardust_capsule.glb (2.2 MB)
- esas_crew_module.glb (7 KB)
- voyager_antenna.glb (166 KB)
- satkit_radio1.glb (8 KB). satkit_radio2.glb is no longer used by the nose but the body still uses it.

The NASA vehicle models suggested for cutting pieces (redstone.glb, atlas.glb, saturn_v.glb, gemini.glb, apollo_soyuz.glb)
were inspected but not used: redstone.glb and atlas.glb hold only the Mercury capsule (Freedom 7, Friendship 7) with no
escape tower, and saturn_v.glb, gemini.glb and apollo_soyuz.glb are single merged meshes that cannot be cut by node.
