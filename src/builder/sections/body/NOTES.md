# Body section: notes

Owner: the body section agent (Role 1). Files: `parts.json`, `section.json`, `internals.json`, `art.js`, this file, `ASSETS.md`.

## What is here

- **55 parts** (39 kept with the same ids and numbers, 16 new), **11 shapes**, **9 rows**, **8 kits** (tank and avionics extended; solar unchanged; new: `tank_h2`, `tank_common`, `tank_common_h2`, `tank_balloon`, `stage_structure`).
- New parts:
  - Tanks: `tank_l_kerolox_stretch`, `tank_m_kerolox_stretch`, `tank_l_hydrolox_stretch` (stretched barrels); `tank_l_kerolox_common` (Falcon 9), `tank_l_hydrolox_common` (S-II / S-IVB), `tank_l_methalox_steel` (Starship), `tank_s_kerolox_carbon` (Electron): common-bulkhead pairs; `tank_m_kerolox_balloon` (Atlas), `tank_m_hydrolox_balloon` (Centaur): pressure-stabilised steel balloons.
  - Structure: `intertank_l` (Shuttle ET style), `intertank_m` (Soyuz core), `interstage_l_composite` (Falcon 9), `avionics_iu_l` (Saturn V Instrument Unit).
  - Side parts: `feedline_external` (Shuttle ET LOX line), `cable_raceway` (full-length raceway), `copv_rack` (three COPVs).
- Shapes: `methalox_core`, `delta_core`, `hydrolox_core` (ids kept; `hydrolox_core` is now the real Shuttle External Tank layout: LOX tank, intertank, LH2 tank, external feed line), plus `falcon9_s1`, `saturn_sic`, `saturn_sivb`, `atlas_balloon`, `soyuz_blok_a`, `starship_steel`, `electron_carbon`, `centaur_balloon`.

## Data conventions

- A separate-dome tank next to another separate-dome tank of the same propellant, or next to `intertank_l` / `intertank_m` / `centerbody_m` (layout `entry.above` / `entry.below`), is drawn as one propellant of a pair: one label, no band. Oxygen is the upper tank, except across `centerbody_m`, whose `look.fuelAbove` says the Delta II put its kerosene on top.
- Hydrogen tanks use their own kits (`tank_h2`, `tank_common_h2`): no nitrogen pressurisation, and spray-on foam is the neutral "as designed" insulation (the art draws them in foam); bare metal is an option (mass ×0.97, cost ×0.95, reliability −0.2 %).
- Shapes preset options where the real vehicle calls for it (stack items may be `{ type, options, material }`): the Delta II centerbody is isogrid.
- The structure kit's "Honeycomb sandwich" (×0.88) is built in whatever material the part has, so it does not double up with the carbon-fibre material; the art draws the skin in the part's material (carbon, steel, titanium or painted metal).

- Tank parts carry an extra `look` field read only by `art.js`: `{ skin: 'paint'|'steel'|'carbon'|'foam', build: 'separate'|'common'|'balloon', tanks: [[label, fraction], ...] }` (top to bottom). The art draws an intertank band (separate domes) or one weld line (common bulkhead) at the split, and labels each propellant.
- The player's choices change the skin: material stainless/carbon/titanium/Al-Cu, insulation foam (orange) or MLI (gold); choosing *Common bulkhead* inside a standard tank replaces the band with a weld line. Stage structure shows the chosen construction (stringers, isogrid, orthogrid, corrugated, carbon) and FSW weld seams.
- Parts whose material is their identity (steel balloons, Starship steel, Electron carbon, the composite interstage) have **no `materialFamily`**, so the card does not offer (or mislabel) a material; the detail text names the material.
- Kits for parts built a fixed way start from a neutral "as designed" option (`tank_common`/`tank_balloon` bulkhead), so the first option is always the baseline the part's numbers already include.
- No separation-system slot: this game flies one stage and never separates, so a separation choice would mislead players. The structure kit offers construction and joints instead.
- Long side parts (feed line, raceway, wiring tunnel) are drawn centred on their attach point, matching how stats.js counts a radial part's centre (centerY = attach point). Short ones stand on it. Every side part's inner face sits at `-0.45 × userData.width`, which the scene places exactly on the host wall.

## Balance (each shape on the Reliable nose and tail, single large engine)

| Shape | Propellant | Δv | TWR | Notes |
|---|---|---|---|---|
| methalox_core | 56 t methalox | 5,543 | 1.37 | unchanged (Reliable's own body) |
| hydrolox_core (Shuttle ET) | 43 t hydrolox | 5,441 | 1.35 | now reaches Mars (was 4,787) |
| atlas_balloon | 57.5 t kerolox | 5,471 | 1.34 | light, reliability 98.8 % |
| starship_steel | 56 t methalox | 5,481 | 1.37 | cheap, reliability 99.9 % |
| falcon9_s1 | 67 t kerolox | 5,447 | 1.15 | needs more thrust (cluster or boosters); with the tail's `soyuz` tail 5,575 / 1.44 |
| delta_core | 90 t kerolox | 5,801 | 0.87 | unchanged; flies with solids |
| saturn_sic | 108 t kerolox | 6,128 | 0.74 | needs solids or a cluster (works with `single_solids`, `atlas_v`, `titan_ii`, `vulcan`) |
| soyuz_blok_a | 62.5 t kerolox | 5,148 | 1.21 | heavy structure; works with the `soyuz` tail |
| saturn_sivb, centaur_balloon, electron_carbon | 26 / 20 / 20 t | 4,797 / 4,345 / 3,206 | | upper stages and a small rocket: their cons say to add a tank |

Reliable and Workhorse presets are unchanged (same part numbers): no warnings, both reach Mars.

## Requests to the lead

1. **Re-bake the card icons** (`node src/builder/tools/bake-icons.mjs`): `data/icons.json` lists baked PNGs for the old tanks, `wiring_tunnel`, `centerbody_m`, `interstage_m`, `avionics_ring_m` and the old `int:tank:*` / `int:avionics:*` options, so the cards still show the old art for those. New parts and new options render live already.
2. **Delta core / Workhorse look:** the Workhorse preset (and the `delta_core` shape that matches it) puts the M-size `centerbody_m` and `avionics_ring_m` between L tanks, so the 3D shows a step in and out. The real Delta II was one diameter (2.44 m). Keeping the stack recognised as the preset was more important than fixing it inside my folder; an L centerbody plus a preset update would fix it.
3. The tail section's `octaweb` tail currently makes the Falcon 9 body LOW_DV and costs about $8.4M; the Falcon 9 body flies well on the `soyuz` tail. Worth a look when the tail balance settles.
4. New body parts have no Role 3 flight-scene art yet (the known hologram issue in docs/SHARE_PROBLEMS.md).
