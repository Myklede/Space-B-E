# Tail section: notes

Owned by the tail section agent. Data in `parts.json`, `section.json`, `internals.json`; art in `art.js`.

## What is here

- **11 shapes**, each a real rocket's tail: One big engine (Redstone / Delta II core), One engine + three solids
  (Delta II 7320), Boattail + two big solids (Atlas V 521), Wide core + two big solids (Ariane 5), Two engines side by
  side (Titan II GLV), Two engines + two solids (Vulcan VC2), Three engines + two big solids (Space Shuttle),
  Four chambers + four liquid boosters (Soyuz), Five engines, fairings and fins (Saturn V S-IC), Seven engines
  (New Glenn), Nine engines (Falcon 9 Octaweb). The three original ids (`single_engine`, `single_solids`, `octaweb`)
  are kept.
- **30 parts** (14 kept, 16 new): thrust structures for 1 (S, M, L, boattail), 2, 3, 4, 5, 7 and 9 engines; a Soyuz-type
  liquid strap-on booster; a Shuttle-type segmented solid; grid fins; S-IC engine fairings; Falcon-type folding legs;
  electric gimbal actuators, vernier thrusters and jet vanes in the steering row. All four steering parts carry
  `flags.bonusGroup: "steering"` (their reliability bonuses count once) and `gimbal` or `steering` flags.
- **Kits**: new `thrust` (base heat shield, propellant feed with prevalves, POGO suppressor) on every thrust structure;
  new `strapon` (chambers, turbine drive) on the liquid booster; `engine` gains full-flow staged combustion, combustion
  tap-off and an ablative nozzle; `booster` gains a finocyl grain and liquid-injection steering; `legs` gains telescoping
  pistons, Viking dish feet and a new touchdown-sensor slot (radar only / contact probes / load cells). Option 0 of every
  slot is the neutral baseline.
- **Art** (`art.js`, all procedural except the Shuttle SRB): engines with turbopump, inlet ducts, gas-generator exhaust
  (or preburners, expander loops, electric motor, pressure-fed valves, following the chosen cycle), chamber and the bell
  for the chosen nozzle (short sea-level or long vacuum bell), tinted by fuel, with the chosen nozzle extension;
  thrust structures drawn as their real counterparts (open thrust cone, Atlas boattail, Octaweb octagonal plate, S-IC
  black-and-white quadrants, Shuttle black base, Soyuz grey, base plate with fabric curtains / rigid shield / bare beams
  following the base-shield option); GEM solids; NASA's Shuttle SRB model wrapped with clamp struts; Soyuz booster with
  its cone leaning in to the core, four chambers, two verniers and the air rudder; swept fins, titanium grid fins, S-IC
  fairings, Falcon legs reaching the ground; gimbal actuators, verniers, jet vanes. Exploded-view pieces for the
  `thrust`, `strapon`, `booster` and `legs` kits. Thrust-structure pictures (cards) show a bell under every mount.

## Balance (each shape applied on the Reliable preset, methane forced by the body; current shared code)

| Shape | Default engines | Ship cost | TWR | Δv vs 5,400 needed | Warnings |
|---|---|---|---|---|---|
| single_engine | 1 × L + jet vanes | $3.15M | 1.37 | +80 | none |
| single_solids | 1 × L + 3 GEM-40 | $4.08M | 2.32 | −170 | LOW_DV |
| atlas_v | 1 × L + 2 GEM-63 | $4.20M | 2.41 | −130 | LOW_DV |
| ariane_5 | 1 × L + 2 SRB | $4.48M | 2.47 | −140 | LOW_DV |
| titan_ii | 2 × L | $4.34M | 2.61 | −510 | LOW_DV |
| vulcan | 2 × M + 2 GEM-63 | $4.24M | 2.03 | −220 | LOW_DV |
| space_shuttle | 3 × S + 2 SRB | $4.09M | 1.97 | −240 | LOW_DV |
| soyuz | 4 × S + 4 liquid boosters + verniers | $4.84M | 1.60 | +260 | none (reliability 80.9 %) |
| saturn_sic | 5 × M | $5.38M | 1.89 | −850 | OVER_BUDGET, LOW_DV |
| new_glenn | 7 × M | $6.46M | 2.58 | −1,080 | OVER_BUDGET, LOW_DV |
| octaweb | 9 × S | $4.46M | 1.18 | −410 | LOW_DV, LOW_TWR |

(+ $150k launch fee; Reliable alone: $3.04M, TWR 1.38, Δv 5,587.) Every shape except Soyuz (verniers) and the
original single_engine (jet vanes) brings a hydraulic gimbal, as its real engines swivel, so none reads UNSTABLE on
Reliable. Each shape's cons say in plain words what the player will see: how far short of Mars it falls with the
Reliable body, and for the 5, 7 and 9-engine tails why they do not fit (S-IC and New Glenn: small pumps cannot leave the
pad, medium pumps are over budget; Octaweb: nine small pumps are affordable but give TWR 1.18). Soyuz fits the budget
with only about $10k to spare. Super Heavy (33) and N1 (30) were left out: 33 small engines cost $8.7M.

Only Falcon 9 and New Glenn carry landing legs in real life, so only those two shapes bring legs; the others keep the
ship's own landing gear (re-hosted to the new engine), and a ship built from nothing gets a "No landing gear" warning
until the player adds legs in the Landing gear row.

## Quirks of shared code this folder relies on

1. `bay/partArt.js` draws a cluster engine at every mount scaled by `mounts.scale` and lifted by `height × (1 − scale)`.
   `engineArt()` wraps each copy in the inverse transform so it can size the engine to the real gap between mounts.
   If that transform changes, change `engineArt()`.
2. `designScene.js` and `hangarScene.js` shift every part whose id contains `fin` by `host radius − 1.2` m (made for
   Role 3's fin, which carries a +1.2 m offset). The tail's fins and grid fins carry the same offset (`FIN_SHIFT`).
3. Radial art is placed at `host radius + userData.width × 0.45` (boosters: `+ width / 2 + 0.05`, legs: on the axis).
   Steering parts undo that offset to draw around the engine axis; the engine fairing sets `width = 0` to hug the skin.
4. Boosters are drawn from a quarter of their length below the clamp point to three quarters above it (never into the
   ground), so their nozzles sit near the core's engines.

## Requests to the lead

Done by the lead since the first report: engine redraw on nozzle change, double legs and fins (a shape now replaces the
old parts of its rows), booster centre of mass at clamp + 0.25 H, chamber and nozzle scaled by pump size.

1. **Re-bake icons.** Baked PNGs in `public/assets/icons/` override the new art for `engine_s`, `engine_m`, `engine_l`,
   `srb_s`, `srb_m`, `fin_s`, `fin_m`, `fin_l`, `gimbal_ring` and the `int:engine:*`, `int:booster:*`, `int:legs:*`
   option pictures (booster and legs pieces are now drawn by `tail/art.js`).
2. **Fin shift.** `partMeshes.finMesh` has no +1.2 m offset, so any shared fin is buried 1.2 m inside its host. If you
   remove the shift instead, set `FIN_SHIFT = 0` in `tail/art.js`.
3. **Flight scene.** New ids still render as holograms in Role 3's flight art (known issue): the `thrust_*` frames,
   `srb_l`, `booster_liquid_m`, `aft_fairing_m`, `verniers`, `jet_vanes`, `gimbal_emech`. (`legs_falcon_m` matches
   Role 3's legs and `fin_grid_m` its fin.)
4. `public/assets/nasa/shuttle_engines.glb` is no longer used by any tail part (the engines are procedural now).
