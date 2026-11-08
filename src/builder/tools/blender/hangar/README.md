# VAB-inspired high bay — hand-over to Claude

This is a new standalone asset kit and inspection template for Role 1. Existing game scenes, shared Blender helpers, other assets, dependency manifests and Git state were not edited by this task. Leave these files uncommitted for Claude to review. The human's port 5173 server was not restarted.

## Run and rebuild

From the repository root, in PowerShell (Node 26.13.0, Blender 5.2.3 LTS):

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' -b --factory-startup -P src/builder/tools/blender/hangar/build.py -- --out public/assets/models/builder/hangar
npx vite --port 5280 --strictPort --config src/builder/tools/blender/hangar/vite.config.mjs --configLoader native
```

One Blender command rebuilds **all 24 GLBs and layout.json**. No installation required. The generator disables Python bytecode writes before importing the existing `common.py`; it uses `common.G`, materials and Draco export. Export in one batch, with nobody inspecting a half-written GLB. The Vite config uses `%TEMP%/hangar-scratch/vite-cache-5280`, isolating the dependency optimizer from the user's running game server. On this environment Vite needs normal process permissions: restricted execution produced `spawn EPERM` on DRACOLoader's asset resolution.

Open **http://localhost:5280/sandbox/role1.hangar.html**. Add `?blockout=1` for grey-box massing. The page has a placeholder rocket, three collar sizes, top-down retraction, elevator stops, crew-arm extension, crane trolley/hook and door controls; ground, overview and access-level cameras; first-person ground walking; LOD, wireframe and collider overlays. The cutaway switch hides front cladding and door for inspection. Turn it off to see the complete envelope.

```powershell
node src/builder/tests/hangar-models.test.mjs
node src/builder/tests/models.test.mjs
node src/builder/tests/builder.test.mjs
npm run check:static
node src/builder/tools/blender/hangar/inspect.mjs
```

The last command uses **one** Chrome process and one page, sequentially. It captures original geometry, tests S/M/L against 8/36/60 m ships, checks moving nodes and ground collision, measures complete-hall budgets, then opens the actual game's HANGAR on 5280. It writes `refs/inspection.json`, eight small JPGs under `refs/shots`, and two original-render comparison sheets. It does not start/stop any server. `refs/models-test.log`, `builder-test.log`, and `static-check.log` hold the requested existing-check results.

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

`sandbox/role1.hangar.js` loads with GLTFLoader + DRACOLoader, decoder path `/assets/draco/`, and one decode worker. It caches materials by name and groups all placements by **module + mesh node** into InstancedMesh batches. Thus ordinary kit modules are one draw call each; independently moving or optional hero nodes use their own batches. Geometry is shared, never cloned per placement. World transforms must include the GLTF scene root transform. Do not merge away `pose_`, `attach_` or `slot_` hierarchy.

For height-based LOD, use a placement's `lod` file when its base Y > 30. Tower, wall and roof LODs are respectively 20%, approximately 13%, and approximately 14% of the full triangle count. Platform variants are filtered before batching. Do not draw all collar variants on top of each other. The viewer updates instance matrices every frame for clarity; production should freeze static batches and update only moving instances. Disable helper overlays when measuring rendering cost.

All GLB geometry has baked transforms, triangulated faces, consistent outward normals, `m_<node>` mesh names, shared PBR vertex-paint materials (metalness .35, roughness .56), and Draco compression. Lamp geometry uses an emissive material, **no glTF lights**. No external textures or photographs. No dependency additions.

## Colliders and integration limits

`colliders[]` entries have `kind`, `center:[x,y,z]`, `size:[x,y,z]`. Dynamic platform boxes also have `level` and `side`; add the current signed slide offset to center X. Door boxes add the animated Y offset. Collider helper render colours distinguish decorative stair envelopes.

Floor, wall, ML, tower, landing and platform boxes are supplied. Platform tapers are approximated by four AABBs per half. These boxes deliberately omit the tiny curved collar infill; use deck geometry or radial tests if walking around that edge. Tower volumes and stairs are **conservative envelopes**, suitable for the ground demo; they are not a navigable multi-storey collision mesh. The sandbox walk is a ground-plane, axis-separated 0.30 m-radius collision check (eye Y 1.7), not a replacement for the game's controller. Do not use the solid tower envelopes to block players riding upstairs: replace with structural post colliders, walk surfaces and stair ramps when integrating.

## For Claude

1. Review and commit only the new allowed paths. Only a read-only Git status of these paths was used; no Git mutation was performed. The game hangar remains its existing implementation.
2. Integrate loading/instancing and light setup into the existing renderer and single game loop. Do not import the sandbox's standalone renderer or animation loop into `src/`.
3. Move the rocket base to ML_TOP and extend the hangar camera/clipping/fog and walking boundary for the 44 × 44 × 80 m envelope. Place the seven existing engineering consoles in the reserved rectangle, facing +Z. Use only existing game event/state/station names.
4. Synchronize platform closure with the actual ship radius, local shape and boosters; prevent closing on a person. Add appropriate access gates/interlocks and safe walking surfaces. Preserve collision and camera continuity during elevator movement; replace decorative stair envelopes with walkable ramps if the stairs should be usable.
5. Map the chosen capsule hatch to the closest level, handle the remaining vertical gap, align the crew arm and add the walk-in transition and sound. The kit does not introduce a new ShipSpec field or claim that `stats.cabin` is available.
6. Implement production crane/door mechanics, collision updates, environmental audio and disposal lifecycle. The door's simple whole-node lift is intentionally only a preview.
7. Reference photos stay outside the repo. `refs/LICENSES.md` documents provenance. Comparison PNGs contain only our own blockout/detail renders.

## Evidence and budgets

The model test parses GLB JSON rather than trusting a triangle count printed by Blender. It checks Draco, required nodes, names, size, material limits, the ML datum, all placement references, levels, and worst-visible whole-hall counts (largest collar choice per half, complete hall, no frustum-culling deduction). See the generated table below and `refs/inspection.json` for measured runtime values and browser/viewport. Headless FPS on this machine is a local benchmark, not a prediction for the final game with its other systems.

<!-- GENERATED_METRICS -->

| File | Triangles per GLB (all variants) | KiB |
|---|---:|---:|
| `kit/tower_bay.glb` | 1,200 | 5.56 |
| `kit/tower_bay_lod.glb` | 240 | 2.26 |
| `kit/wall_bay.glb` | 372 | 2.64 |
| `kit/wall_bay_lod.glb` | 48 | 1.62 |
| `kit/roof_truss.glb` | 504 | 3.55 |
| `kit/roof_truss_lod.glb` | 72 | 1.73 |
| `kit/stair_run.glb` | 432 | 3.26 |
| `kit/catwalk.glb` | 612 | 3.39 |
| `kit/standpipe.glb` | 72 | 1.73 |
| `kit/cable_tray.glb` | 300 | 2.19 |
| `kit/lamp.glb` | 24 | 1.56 |
| `kit/floor_tile.glb` | 36 | 1.39 |
| `kit/girder.glb` | 36 | 1.42 |
| `kit/crate.glb` | 36 | 1.60 |
| `kit/cart.glb` | 144 | 2.04 |
| `kit/scissor_lift.glb` | 264 | 2.60 |
| `kit/safety_stripe.glb` | 72 | 1.54 |
| `platform_half.glb` | 3,840 | 22.85 |
| `mobile_launcher.glb` | 1,392 | 5.45 |
| `elevator.glb` | 2,064 | 9.25 |
| `crew_arm.glb` | 420 | 4.12 |
| `crane_bridge.glb` | 960 | 6.11 |
| `high_bay_door.glb` | 924 | 4.15 |
| `console_desk.glb` | 96 | 1.95 |

**24 GLBs**, 859 placements. GLBs total **96,200 bytes**. Whole exported directory including layout: **392,390 bytes (0.374 MiB)**, against 15 MiB.

| Runtime mode, complete envelope | Triangles drawn | Total calls | Structure batches | Geometries in memory | FPS |
|---|---:|---:|---:|---:|---:|
| Full detail | 384,684 | 35 | 25 | 135 | 165.0 |
| LOD above 30 m | 266,964 | 37 | 27 | 135 | 165.0 |

Measured 2026-11-08T09:57:14.607Z, Chrome 156.0.8078.80, headless, 1280 × 800 pixels, device scale 1. The ground inspection view measured 117.0 FPS. Total calls include the placeholder, scale witness and ropes; geometries include grey-box objects retained for the toggle. The structure uses 25–27 batch objects; frustum culling may reduce visible calls. No shadows or extra render passes are enabled.

### Validation outcome

- `hangar-models.test.mjs`: PASS, including GLB budgets and highest-cost visible collar choice.
- Existing `models.test.mjs`: PASS. Existing `builder.test.mjs`: PASS.
- `npm run check:static`: PASS without overrides.
- Sandbox: 0 console/page errors; 0 failed HTTP responses during the recorded inspection.
- Game on 5280: state HANGAR, 7 advancing frames observed, 0 console/page errors. This is a boot smoke check, not a full game-loop check.
- All 9 height/radius combinations put above-ship levels at the retracted offset. Elevator cab reaches Y 47; crew-arm tip reaches X −1.25 for M; trolley, hook and door move independently. Ground walking stops outside the ML at Z −8.33 with eye Y 1.7.

### Screenshots

- [ground-look-up](refs/shots/ground-look-up.jpg)
- [platforms-closed](refs/shots/platforms-closed.jpg)
- [platforms-retracted](refs/shots/platforms-retracted.jpg)
- [elevator](refs/shots/elevator.jpg)
- [crew-arm](refs/shots/crew-arm.jpg)
- Grey-box: `refs/shots/blockout-ground.jpg`, `blockout-overview.jpg`, `blockout-platform.jpg`.
- [Own blockout vs detail](refs/compare-massing.png); [own closed vs retracted](refs/compare-platform-motion.png).

### Scope left for integration

All requested asset and sandbox deliverables are supplied. This is a visual modular kit, not a certified structural or mechanical design. No game integration, sound, first-person elevator riding, stair locomotion, moving-player interlocks, or capsule door transition has been installed; those are Claude’s integration tasks. The sandbox door preview raises the whole door node, and production should telescope its panels. Read the collider caveats above before using the solid tower envelopes upstairs.

Regenerate this table after rebuilding and inspecting: `node src/builder/tools/blender/hangar/report.mjs`.
