# Nose section: assets

## Wave 4 (2026-11-07): no new files yet

The 50 new parts of wave 4 have no model file yet. The planned Blender models (slugs, sizes, priorities) are listed in
`NOTES.md`; a part gets `"model": { "builder": "nose/<slug>" }` only once `public/assets/models/builder/nose/<slug>.glb`
exists. Until then the code-drawn art in `art.js` and `bay/partMeshes.js` is used.

Free models the modeller may use (credit here when shipped):

| Source | Licence | Use |
|---|---|---|
| Smithsonian 3D, Apollo 11 command module "Columbia" scan (https://3d.si.edu) | CC0 | measuring the Apollo command module; a 1K crop of its texture for the charred Avcoat look |
| Smithsonian 3D, Apollo 11 crew hatch scan and CAD (https://3d.si.edu) | CC0 | decimated as the Apollo capsule's `slot_hatch` piece |
| NASA 3D Resources: Mercury on Redstone and Atlas, Gemini, Orion capsule STL, SLS Block 1 (https://science.nasa.gov/3d-resources/, https://github.com/nasa/NASA-3D-Resources) | NASA (public domain) | proportions and outer mould lines |

Reference photos and drawings used for measuring are listed with their licences in the wave-4 research folder
(`refs/LICENSES.md`); none of them is shipped.

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
