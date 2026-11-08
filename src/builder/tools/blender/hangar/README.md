# VAB-inspired high bay — hand-over to Claude

This is a new standalone asset kit and inspection template for Role 1. Existing game scenes, shared Blender helpers, other assets, dependency manifests and Git state were not edited by this task. Leave these files uncommitted for Claude to review. The human's port 5173 server was not restarted.

## Run and rebuild

From the repository root, in PowerShell (Node 26.13.0, Blender 5.2.3 LTS):

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' -b --factory-startup -P src/builder/tools/blender/hangar/build.py -- --out public/assets/models/builder/hangar
npx vite --port 5280 --strictPort --config src/builder/tools/blender/hangar/vite.config.mjs --configLoader native
```

One Blender command rebuilds **all 26 GLBs and layout.json**. No installation required. The generator disables Python bytecode writes before importing the existing `common.py`; it uses `common.G`, materials and Draco export. Export in one batch, with nobody inspecting a half-written GLB. The Vite config uses `%TEMP%/hangar-scratch/vite-cache-5280`, isolating the dependency optimizer from the user's running game server. On this environment Vite needs normal process permissions: restricted execution produced `spawn EPERM` on DRACOLoader's asset resolution.

Open **http://localhost:5280/sandbox/role1.hangar.html**. Add `?blockout=1` for grey-box massing. The page has a placeholder rocket, three collar sizes, top-down retraction, elevator stops, crew-arm extension, crane trolley/hook and door controls; ground, overview and access-level cameras; first-person ground walking; LOD, wireframe and collider overlays. The cutaway switch hides front cladding and door for inspection. Turn it off to see the complete envelope.

```powershell
node src/builder/tests/hangar-models.test.mjs
node src/builder/tests/models.test.mjs
node src/builder/tests/builder.test.mjs
npm run check:static
node src/builder/tools/blender/hangar/inspect.mjs
```

The last command uses **one** Chrome process and one page, sequentially. It captures original geometry, tests S/M/L against 8/36/60 m ships, checks moving nodes and ground collision, measures complete-hall budgets, then opens the actual game's HANGAR on 5280. It writes `refs/inspection.json`, sequential JPEG captures under `refs/shots`, and original-render comparison sheets. It does not start/stop any server. `refs/models-test.log`, `builder-test.log`, and `static-check.log` hold the requested existing-check results.

## Coordinate and motion contract

- Metres, game +Y up, origin on the floor at the rocket axis. Inside bounds X/Z −22…22, Y 0…80. Front door faces −Z; rear wall +Z. Ship base at **ML_TOP = 7 m**; its height excludes this deck offset.
- Eleven numeric levels **01…11**, ascending from Y **11,17,23,29,35,41,47,53,59,65,71**. They are gameplay levels, not NASA's lettered levels. Real HB3 uses A,B,C,D,E,F,G,H,J,K; see [research](refs/NOTES.md).
- Tower bays are 6 × 6 × 6 m; blocks centred X ±17, assembled along Z −6,0,+6 up to 72 m. Platform root is at [0,levelY,0]. The +X half uses Y rotation 0, the −X half uses Y rotation 180 degrees, never a negative scale. `attach_slide` local +X points outward for each half.
- Closed local X offset is **0 for all sizes**. Pick **exactly one** of `slot_cut__s`, `slot_cut__m`, `slot_cut__l`: nominal radii 0.9375,1.25,1.6875 m plus 0.25 m inner-edge clearance. Circular arcs use 32 segments; tiny chord approximation is expected. Retraction is **+4 m local X**, i.e. ±4 m in world X; at least 3 m additional clearance. Keep levels above the ship and beside side boosters retracted. The sandbox automatically handles height; production booster checks belong to Claude.
- The half-deck tapers from 12 m wide at the tower to 5 m near the collar, exposing more of the ship from the entrance while retaining the close-fitting collar. Fixed catwalks remain in the towers. Retraction may overlap the racks as intended.
- Elevator root [-17,0,-11], `pose_cab` translated in Y. Stops: ground 0, then every platform elevation. Cab footprint 2.4 × 2.4 m, height 2.6 m. Door faces +Z; short landing bridges connect to fixed tower decks. Decorative zigzag stairs and return landings rise from the ground through level 01 and continue beside the shaft.
- Crew arm root at platform elevation, normally X −8, Z 0, facing +X. `attach_root` is local [0,0,0]; `attach_tip` is [2,0,0] under `extend`, whose rest X is 4. Rest reach 6 m. Move `extend.position.x` from 4 to 6 for 0…2 m extra reach; the 4 m sleeve retains overlap, so no floor gap opens. To reach the left face of a radius-r rocket from X −8, extension is **2 − r**. The white room travels intact, without scaling handrails. Pick nearest level to the **absolute world Y** hatch height. The difference between hatch height and the discrete level must be handled by production integration; do not move the player's camera into solid cabin art.
- Crane root Y 75, bridge along X. `pose_trolley.position.x` −17…17; `pose_hook.position.y` negative downward. The viewer draws two simple ropes and changes their length to the hook. No load rating or physics is asserted.
- `pose_door` moves +Y in the viewer as a staging demonstration. The seven panels form a separate node. A production telescoping door should keep its panels inside the roof envelope rather than lifting the full 70 m door intact above it.
- `attach_deck` on the mobile launcher is [0,7,0]. No launcher tower. Ground console area X −10…10, Z −20…−12 is clear of props; floor guide strips can cross it. Entry [0,1.7,−20]. Optional `console_desk.glb` is supplied but **not placed**.

## Layout schema and instancing

`layout.json` is versioned data:

```json
{
  "version": 1,
  "units": "metres",
  "up": "+Y",
  "ML_TOP": 7,
  "modules": {
    "tower_bay": {"file":"kit/tower_bay.glb", "triangles":1200, "bytes":5700, "bounds":{"min":[-3.3,0,-3.3],"max":[3.3,6,3.3]}}
  },
  "placements": [{"id":"tower_bay_0","module":"tower_bay","position":[-17,0,-6],"rotation":[0,0,0],"scale":[1,1,1],"lod":"tower_bay_lod"}]
}
```

The numeric `bytes` and bounds in this example are illustrative; read each actual manifest entry. Rotations are **degrees**, XYZ Euler order. Additional top-level data: `radii`, `hallBounds`, `consoleArea`, `playerEntry`, `levels`, `elevator`, `crewArm`, `colliders`. A placement may have `dynamic`, `level` and `side`. Every placement has a unique ID. `levels[].halves` contains the relevant placement IDs.

`sandbox/role1.hangar.js` loads with GLTFLoader + DRACOLoader, decoder path `/assets/draco/`, and one decode worker. It caches materials by name and groups all placements by **module + mesh node** into InstancedMesh batches. Thus ordinary kit modules are one draw call per mesh/material each; independently moving or optional hero nodes use their own batches. Geometry is shared, never cloned per placement. Closed meshes use back-face culling, avoiding the substantial cost of two-sided steel. World transforms must include the GLTF scene root transform. Do not merge away `pose_`, `attach_` or `slot_` hierarchy.

For height-based LOD, use a placement's `lod` file when its base Y > 30. Tower, wall and roof LODs are respectively 20%, approximately 13%, and approximately 14% of the full triangle count. Platform variants are filtered before batching. Do not draw all collar variants on top of each other. The viewer freezes static instance matrices after assembly; only independently moving modules update each frame. Disable helper overlays when measuring rendering cost.

All GLB geometry has baked transforms, triangulated faces, consistent outward normals, `m_<node>` mesh names, module-specific baked PBR materials (see v2 notes below), and Draco compression. Lamp geometry uses an emissive material, **no glTF lights**. External bake atlases and original CC0 texture sources accompany the portable embedded-texture GLBs; no reference photographs are included. No dependency additions.

## Colliders and integration limits

`colliders[]` entries have `kind`, `center:[x,y,z]`, `size:[x,y,z]`. Dynamic platform boxes also have `level` and `side`; add the current signed slide offset to center X. Door boxes add the animated Y offset. Collider helper render colours distinguish decorative stair envelopes.

Floor, wall, ML, tower, landing and platform boxes are supplied. Platform tapers are approximated by four AABBs per half. These boxes deliberately omit the tiny curved collar infill; use deck geometry or radial tests if walking around that edge. Tower volumes and stairs are **conservative envelopes**, suitable for the ground demo; they are not a navigable multi-storey collision mesh. The sandbox walk is a ground-plane, axis-separated 0.30 m-radius collision check (eye Y 1.7), not a replacement for the game's controller. Do not use the solid tower envelopes to block players riding upstairs: replace with structural post colliders, walk surfaces and stair ramps when integrating.

## Steel detail pass v2 (2026-11-08)

The human explicitly authorized staying on the shared `role1-builder` branch without fetch/switch/pull. Git remains Claude's responsibility. Only this kit, its source tools/tests and the standalone sandbox were edited. Original renders and the complete v1 layout contract are retained in `refs/before/` and `refs/contract-v1.json`.

### Rebuild and bake

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' -b --factory-startup -P src/builder/tools/blender/hangar/build.py -- --bake --out public/assets/models/builder/hangar
npx.cmd vite --port 5280 --strictPort --config src/builder/tools/blender/hangar/vite.config.mjs --configLoader native
node src/builder/tests/hangar-models.test.mjs
node src/builder/tools/blender/hangar/inspect.mjs
node src/builder/tools/blender/hangar/report.mjs
```

Use `--bake` after **any geometry, UV, colour or material change**. Omitting it reuses existing atlas JPGs for quick re-export; it is safe only when geometry/UVs/materials are identical. Missing atlases always bake. For a deliberate partial bake use `--only platform_half_lod,roof_truss_lod`; untouched manifest entries are retained. Full rebuilds remain the reproducibility reference. The source JPEGs and their Poly Haven download metadata are included under `textures/`, so rebuilding needs no network or package installation. One Blender process uses Cycles CPU, four threads, eight samples, sixteen AO samples, 0.75 m AO distance. Two emission bakes per mesh produce colour with real ray-traced AO and grime, and linear R=AO/G=roughness/B=metalness. No photographic reference is sampled. UV `Atlas` packs faces; UV `Detail` keeps metre-based tiling for normal maps. JPEG normal maps are reduced to 512 square. AO darkens base colour and also feeds glTF occlusion; the duplicate contact contribution is intentional for this dark rig.

### Geometry, materials and LOD

W-section beams have continuous webs/flanges and chamfered flange tips. Tower bays use paired L-angle braces, gusset/bolt groups, stiffeners and column base plates. Platforms and catwalks have real open grating, toe boards and regularly spaced rails. Deep fan ribs and curved ring girders under the platforms create the vault; the collar and its small closing plates remain inside the approved clearance. Stairs have channel stringers and open treads. A separate original caged ladder is placed at the far tower edge. Standpipes are octagonal tubes. The crew arm gains channels and diagonal braces without changing sleeve travel or tip placement.

The sandbox selects tower/wall/roof/platform LOD above 30 m. Access camera presets rebuild batches with full detail within 9 vertical metres of the camera when it is inside the hall (Z > -23); the distant overview keeps the height scheme. Free orbit keeps that selection until another preset or the LOD toggle is used. Each LOD is checked against the full module at 10-25% of its visible triangles. Full geometry remains available via the LOD toggle. A far-side/distance LOD selector is left to Claude's player-camera integration; this viewer uses height plus the access-camera band. Existing placement IDs, transforms, level records and colliders are checked against v1; new ladder placements are appended.

Materials are named `hangar_v2_<module>_<node>`; their atlases are unique to that geometry and must **not** be collapsed into one material by name. Repeated placements share the same material and geometry. Baked metallic values: painted white/yellow/red 0.28, structural/bare steel and grating 0.60, concrete 0. Roughness varies 0.48-0.80. Shared CC0 Blue Metal Plate supplies scratches and normal detail, tinted by our grey/white/yellow/red vertex palette before baking; Hangar Concrete Floor supplies the floor wear. Actual bolts and plate edges supply the silhouette, while the normal map supplies surface detail (there is no high-poly bolt-normal transfer). This is restrained wear, not a severe rust treatment. Lamp lenses alone use `hangar_lamp` with emission strength 8 and cold-white colour; housings remain opaque painted steel. The rocket is a sandbox-only white/orange witness with longitudinal lines and thin stage seams.

### Lighting rig for Claude

The sandbox copies the current `src/graphics/index.js` pipeline: half-float composer, finite-value guard, identical bloom (threshold 1.35, smoothing 0.30, intensity 0.70, mipmap blur, radius 0.72), ACES_FILMIC ToneMappingEffect, SMAA HIGH, chromatic aberration (0.00055,0.00045), vignette (0.36,0.50), overlay grain 0.06. Renderer: NoToneMapping, sRGB output, logarithmic depth, no native MSAA, pixel ratio capped at 1, then multiplied by the adjustable render scale (default 0.60, matching the game approach of reducing resolution to preserve frame rate). At a 1440 x 860 viewport, this renders 864 x 516 internally. Game look is enabled by default; flat comparison bypasses the composer. Exposure starts at 1.15 and can be adjusted. HDRI is the existing Small Hangar 01, converted via PMREM, environment intensity **0.35**, matching designScene. Background/fog colour #111719, FogExp2 density 0.009. Fog is distance based, not a true height-volume simulation.

Hemisphere: sky #cbd9dc, ground #484335, intensity 0.32. Four fixed SpotLights, colour #e7f0ff, distance 110 m, penumbra 0.65, decay 2; positions/targets are world metres, intensity in three.js candela:

| Position | Target | Intensity | Angle (rad) |
|---|---|---:|---:|
| -12,73,-8 | -10,0,0 | 12500 | 0.48 |
| 12,73,8 | 10,0,0 | 12500 | 0.48 |
| -6,18,-12 | 0,26,0 | 3600 | 0.50 |
| 6,54,-8 | 0,42,0 | 6500 | 0.50 |

The last two isolate the rocket. No lights cast runtime shadows: baked module AO provides contact depth while keeping structure rendering to one scene pass. There is one extra DirectionalLight held at zero intensity in Game look, used at 2.3 in flat mode; the hemisphere rises to 1.5 there and spots become zero. Toggle intensities rather than adding/removing lights to keep the shader light count fixed. There are no glTF light objects. Each lamp instance is an emissive fixture, not another actual light.

The performance button records five seconds of actual RAF intervals: average FPS, minimum instantaneous FPS and p95 frame time. Diagnostic overlays are not counted as structure; renderer totals include all post-processing passes. Headless browser/GPU identity is recorded in `refs/inspection.json`, and must be checked before treating results as hardware performance guarantees.

### Remaining integration work for Claude

- Copy the material-aware instancing and rig into the game's own scene and render loop. Do not import this standalone renderer/loop.
- Keep module-specific atlas material names; cache normal maps by source if desired. Embedded normal maps repeat across GLBs to keep each GLB portable; external bake atlases remain for reproducibility and count toward the total budget.
- Add far-side/player-distance LOD when integrating. Keep the existing walking/collision caveats below. New ladder geometry is decorative and adds no collider or locomotion.
- Consolidate attribution into the team's CREDITS.md when committing; it is outside this task's allowed paths. Exact sources and licences are in `refs/LICENSES.md`.
- Atlas colour contains AO and surface wear; the normal is a shared surface tile, not a baked high-poly bolt atlas. Rail sections remain square HSS, intentionally without individual bevels or bolt heads.

## For Claude

1. Review and commit only the new allowed paths. Only read-only Git inspection was used; no Git mutation was performed. The game hangar remains its existing implementation.
2. Integrate loading/instancing and light setup into the existing renderer and single game loop. Do not import the sandbox's standalone renderer or animation loop into `src/`.
3. Move the rocket base to ML_TOP and extend the hangar camera/clipping/fog and walking boundary for the 44 × 44 × 80 m envelope. Place the seven existing engineering consoles in the reserved rectangle, facing +Z. Use only existing game event/state/station names.
4. Synchronize platform closure with the actual ship radius, local shape and boosters; prevent closing on a person. Add appropriate access gates/interlocks and safe walking surfaces. Preserve collision and camera continuity during elevator movement; replace decorative stair envelopes with walkable ramps if the stairs should be usable.
5. Map the chosen capsule hatch to the closest level, handle the remaining vertical gap, align the crew arm and add the walk-in transition and sound. The kit does not introduce a new ShipSpec field or claim that `stats.cabin` is available.
6. Implement production crane/door mechanics, collision updates, environmental audio and disposal lifecycle. The door's simple whole-node lift is intentionally only a preview.
7. Reference photos stay outside the repo. `refs/LICENSES.md` documents provenance. Comparison PNGs contain only our own blockout/detail renders.

## Evidence and budgets

The model test parses GLB JSON rather than trusting a triangle count printed by Blender. It checks Draco, required nodes, names, size, material limits, the ML datum, all placement references, levels, and worst-visible whole-hall counts (largest collar choice per half, complete hall, no frustum-culling deduction). See the generated table below and `refs/inspection.json` for measured runtime values and browser/viewport. Headless FPS on this machine is a local benchmark, not a prediction for the final game with its other systems.

<!-- GENERATED_METRICS -->

| File | GLB triangles, all variants | KiB | Atlas / normal px |
|---|---:|---:|---|
| kit/tower_bay.glb | 2,552 | 720.6 | 1024 / 512 |
| kit/tower_bay_lod.glb | 432 | 115.5 | 512 |
| kit/wall_bay.glb | 372 | 139.5 | 512 |
| kit/wall_bay_lod.glb | 48 | 59.5 | 512 |
| kit/roof_truss.glb | 792 | 182.2 | 512 |
| kit/roof_truss_lod.glb | 84 | 77.9 | 512 |
| kit/stair_run.glb | 1,112 | 214.5 | 512 |
| kit/catwalk.glb | 1,104 | 169.7 | 512 |
| kit/caged_ladder.glb | 1,252 | 189.0 | 512 |
| kit/standpipe.glb | 104 | 43.0 | 512 |
| kit/cable_tray.glb | 300 | 101.2 | 512 |
| kit/lamp.glb | 144 | 3.7 | none |
| kit/floor_tile.glb | 36 | 76.6 | 512 |
| kit/girder.glb | 60 | 59.0 | 512 |
| kit/crate.glb | 36 | 71.4 | 512 |
| kit/cart.glb | 144 | 111.4 | 512 |
| kit/scissor_lift.glb | 264 | 128.6 | 512 |
| kit/safety_stripe.glb | 72 | 55.0 | 512 |
| platform_half.glb | 10,408 | 1125.8 | 1024 / 512 |
| platform_half_lod.glb | 2,364 | 437.7 | 512 |
| mobile_launcher.glb | 1,488 | 166.5 | 512 |
| elevator.glb | 2,160 | 253.6 | 512 |
| crew_arm.glb | 636 | 246.3 | 512 |
| crane_bridge.glb | 1,008 | 263.4 | 512 |
| high_bay_door.glb | 924 | 157.5 | 512 |
| console_desk.glb | 96 | 75.1 | 512 |
 
26 GLBs, 864 placements. GLBs: **5,370,040 bytes**. Entire directory with external bake atlases and layout: **10,292,431 bytes (10.29 MB)** / 20 MB. Every GLB below 60,000 triangles; no hero exemption.

| Game look ON, height LOD | Triangles (all passes) | Total calls | Structure batches | 5 s avg FPS | Instantaneous min FPS | p95 ms |
|---|---:|---:|---:|---:|---:|---:|
| ground-look-up | 413,667 | 64 | 30 | 73.4 | 41.2 | 18.3 |
| overview | 413,739 | 70 | 30 | 123.1 | 54.6 | 12.2 |
| platform-close-up | 480,163 | 60 | 30 | 79.0 | 41.2 | 18.2 |
| collar | 480,067 | 59 | 30 | 77.2 | 41.2 | 18.3 |
| ceiling-vault | 512,763 | 55 | 30 | 97.2 | 54.3 | 18.1 |
 
| Complete envelope | Triangles (all passes) | Total calls | Structure batches | FPS sample |
|---|---:|---:|---:|---:|
| Full detail | 689,987 | 67 | 27 | 101.4 |
| Height LOD | 430,071 | 71 | 31 | 110.3 |
 
Measured 2026-11-08T11:07:22.115Z, Chrome 156.0.8078.80, viewport 1440 × 860, device scale 1, render pixel ratio **0.6**. GPU: ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11). Renderer totals include fullscreen post-processing. No frustum discount is applied to the structure. Minimum is the slowest individual RAF interval, not a rolling one-second average.

Render-scale trials are in refs/scale-trial.json. Lower render scale improves frame rate at the cost of sharpness. This is not a native-resolution 60 FPS claim. Brief dips remain visible in minimum/p95 metrics.

- hangar-test.log: PASS.
- models-test.log: PASS.
- builder-test.log: PASS.
- static-check.log: PASS.
- Sandbox console/page errors: 0. HTTP failures: 0.
- Game HANGAR smoke test on 5280: HANGAR, 7 advancing frames, 0 browser errors.
- Nine height/radius combinations, independent moving nodes and ground ML collision are asserted in inspect.mjs. Static tests compare original layout data, placement IDs/transforms, colliders, dimensions, Draco, budgets and LOD ratios.

Screenshots: refs/before/{ground-look-up,platforms-closed,crew-arm}.jpg; refs/shots/{ground-look-up,overview,platform-close-up,collar,ceiling-vault,elevator,crew-arm,platforms-retracted}.jpg. refs/compare-detail.png contains only our own renders.

Regenerate: node src/builder/tools/blender/hangar/report.mjs
