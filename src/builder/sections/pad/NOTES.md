# Launch pad section: notes

Owner: the pad agent (Role 1). The pad is the ground hardware under the rocket at a real launch complex (decided
2026-11-07, `src/builder/CLAUDE.md` section 6): no date picking. Files:

| File | What |
|---|---|
| `section.json` | `sites` = the 10 launch complexes (each with `kit`, `climate`, `scale`, `fee`, `holdFee`, `aliases`, facts), `equipment` = the 8 kinds of ground hardware, each option with its physical numbers |
| `effects.js` | `padSetup`, `complexOf`, `kitFee`, `heatLimitOf`, `liftoffOn`, `padEffects` (pure, Node-tested) |
| `../../weather.js` | `weatherFor`: launch-day forecast, actual temperature, HOLD fees (pure) |
| `../../designPad.js` (+ `designPad.css`) | the Launch pad card |
| `art.js` | the pad under the ship, each complex's look, and the card pictures (`icon`, `only`) |
| `explain.json` | `pad:<id>`, `equip:<key>`, `equip:<key>/<option>` in English and Vietnamese |
| `../../tests/pad.test.mjs` | `node src/builder/tests/pad.test.mjs` |

`createSections` (sections.js) keeps only `sites` and `equipment` of this folder's `section.json`, so every number lives
on a complex or an option; the model constants are named exports of `effects.js`.

## Where a choice comes from

- `assembly.launch` = `{ site, day, seed?, pad: { key: optionId }, forecast?, repairDue? }`.
  - `site` is the complex id (the old field name, so `sections.padState` and old saves keep working).
  - `pad` holds only the player's own choices; everything else comes from the complex's `kit` (`padSetup`).
  - Choosing a complex on the card resets `pad`, `day`, `forecast` and the old `slot`.
- Old saves: an old `site` id lands on a complex through `aliases` (`cape` → SLC-40, also on Cape Canaveral and the old site's free cold window; `vandenberg` → SLC-4E, `kourou` →
  ELA-3, `baikonur` and `plesetsk` → Gagarin's Start; `starbase`, `wenchang`, `tanegashima`, `mahia` keep their ids), an
  unknown or missing one on the first complex (SLC-40, also at Cape Canaveral). The old `slot: 'cold'` (Cape's free cold
  window, `data/launch.json` `legacyFront`) becomes a 2 °C cold front on day 0; `mild`/`warm` and the other old slot ids
  mean nothing now. Old equipment choices keep their ids (`raised` and `catch` are new).
- `spec.launch` = `{ tempC (the forecast), complex, site, day, pad }`. asBuilt.js flies `actualC` at confirm.

## Heat limit and the four consequences (effects.js)

```
heatLimitKN = mount.heatKN × complex.scale × (deluge.heatF + mount.waterPlate if there is water)
r = thrustSL / heatLimit;  excess = max(0, r − 1)
throttle   = max(1 / r, MIN_THROTTLE 0.6, 1.15 · m·g / thrustSL)   (only when excess > 0; m, g passed by stats.js)
residual   = max(0, r · throttle − 1)            still over the limit at that throttle
overload   = residual + DOSE_SHARE 0.5 × (excess − residual)
(a) liftoffLossMps = g × CLEAR_S 7 s × (1 − throttle)          (no g from the caller: throttle 1, no loss, full overload)
(b) damageChance   = min(0.5, 0.25 × overload × mount.debris × deluge.debrisF)
(c) repairFee      = min($280k, $250k × overload × mount.repair × deluge.debrisF × (1 + 0.25 × tower.exposure)), ≥ $5k, in $5k steps
(d) holdDownCatch  = clamps.catch (any bad engine, debris-hurt or built badly; asBuilt.js rolls it)
reliability  = Σ option.reliability − min(1.5 %, 0.4 % per 1,000 kN × deluge.acousticF)
lightningRisk = day lightning × (0.5 × lightning.strikeF + 0.5 × weather.triggerF)
fee = complex.fee + Σ option.fee + weather.fee (days of HOLD) + launch.repairDue
```

Why these shapes:

- **Heat limit in thrust.** The jet's power is ½·F·vₑ, so for similar engines the heat and the sound the pad takes grow
  with thrust. A mount and trench are designed for a thrust: LC-39's trench for the Saturn V's 34.5 MN, Gagarin's Start
  for the R-7 (about 4 MN), Rocket Lab LC-1 for the small Electron.
- **No gravity literal.** g always comes from the caller (stats.js passes `planets.earth.g`); without it nothing is held
  back and no Δv is lost.
- **Held back for the first seconds (a).** While the plume plays on the pad (until the ship clears its tower, about 7 s
  for the Shuttle; TODO verify the exact figure for other vehicles) the computer runs the engines at the limit. The
  propellant is not lost, but the ship climbs slower and fights gravity longer: catching up costs g · t · (1 − throttle)
  of Δv (mass cancels out). stats.js burns that Δv as propellant on the pad (`liftoffBurn`). The floor of 60 %: booster
  engines are rarely run lower at liftoff (the RS-25 throttled to 67 %; Merlin and Raptor go lower) and the ship must
  still lift: held back, it keeps a thrust-to-weight ratio of at least 1.15. Example: Workhorse (1,771 kN, 125 t) on
  SLC-4E (1,591 kN) would like 90 % but its weight sets the floor at 92 %: it loses about 5 m/s, the pad is slightly
  overloaded (1 % engine damage, $10k of repairs).
- **Overload (b, c).** Throttling to the limit is not free: the slower climb keeps the fire on the pad longer, so half of
  the overload's heat dose stays (game value). Real basis: Starship's first flight (20 April 2023), with no trench and
  no water, cratered the concrete and threw chunks of it hundreds of metres, fine dust up to about 10 km; STS-124
  (31 May 2008) tore more than 3,500 bricks from LC-39A's trench wall, about $2.5 M of repairs. Whether pad debris hurt
  Starship's engines was never confirmed (SpaceX traced the engine failures to propellant leaks), so the game keeps it a
  chance, not a certainty.
- **Damage and repairs are deliberate game values.** `DEBRIS_K` 0.25 keeps the 50 % cap for gross overloads (a big ship on
  a bare slab or on LC-1). Repairs stop at $280k: STS-124's $2.5M was about half a percent of a roughly $450M Shuttle
  flight; here repairs are a few percent of a $3–5M ship, enough to sting without ending a campaign.
- **Water (deluge).** Water turning to steam soaks up heat and sound and keeps loose concrete down. `heatF` 1.3 / 1.6,
  `debrisF` 0.6 / 0.35, `acousticF` 0.6 / 0.35 are game values. Real basis: on STS-1 (1981) the solid boosters'
  ignition overpressure buckled a strut in the nose and damaged 148 tiles; NASA added more pad water from STS-2 on.
  ELA-3's 90 m tower pours about 1,500 m³ at liftoff; LC-39B's holds about 1.5 million litres.
  `waterPlate` 0.85 on the raised mount: with no trench, Starbase's water-cooled steel plate is both the water and the
  flame deflector, so water counts for more there (bare 3,510 kN, with the plate 7,547 kN, the strongest pad). The
  ladder stays honest: at any complex and with the same water, a dearer mount always takes more fire.
- **Hold-down (d).** Saturn V's start sequence began 8.9 s before liftoff and the arms let go only once all five F-1s
  were at full thrust; Falcon 9 holds its nine Merlins a few seconds; the Shuttle shut down on the pad five times after
  its main engines lit (STS-41-D, 51-F, 55, 51, 68). `catch` 0.55 (about 3 s) and 0.7 (about 6 s) are game values. The
  clamps count once: as this catch, not also as reliability.
- **Acoustic load.** Sound power is a small share of jet power (so it grows with thrust); the reliability loss is a game
  value, at most 1.5 %.
- **Lightning.** Half a strike on the waiting ship (STS-115's mast took about 100,000 A in 2006), half lightning set off
  by the climbing ship (Apollo 12 in 1969, Atlas-Centaur 67 in 1987), which the field mills and launch rules prevent.
- **Expensive pads take bigger rockets at full power.** Kit limits run from 22 kN (LC-1) to 3,808 kN (LC-39A) and
  7,547 kN (Starbase with its water plate).

### Calibration (game scale: about one tenth of the real pads)

The game's ships are about a tenth of the real rockets (Reliable: 70 t and 943 kN), so each kit's heat limit is about a
tenth of what the real pad was built for: LC-39A 3,808 kN (Saturn V 34.5 MN), SLC-40 2,055 (Titan IV-B, about 15 MN;
kept a little higher so Workhorse fits), SLC-41 1,794 (Vulcan, about 17 MN), SLC-4E 1,591, ELA-3 1,504 (Ariane 5, about
13–15 MN), Wenchang 1,088 (Long March 5, about 10.6 MN), Yoshinobu 988 (H-IIA/H-IIB), Gagarin's Start 449 (R-7, about
4 MN), Rocket Lab LC-1 22 (Electron, about 0.2 MN); Starbase 3,510 bare (it took Super Heavy's 75 MN once, with heavy
damage) and 7,547 with the water plate. Mount base values: slab 320, raised 900, flame pit 1,550, trench 1,700, mobile
platform 2,000 kN; `scale` (the size of a complex's hardware): LC-39A 1.19, SLC-40 0.93, SLC-41 0.69, Starbase 3.9,
SLC-4E 0.72, Gagarin 0.29, ELA-3 0.47, Wenchang 0.34, Tanegashima 0.38, LC-1 0.0245. With their own kits:

| Complex | Kit fee | Heat limit | Reliable 943 kN | Workhorse 1,771 kN | Day of HOLD |
|---|---|---|---|---|---|
| SLC-40 (first, default) | $172k | 2,055 kN | full thrust | full thrust | $21k |
| LC-39A | $298k | 3,808 kN | full thrust | full thrust | $45k |
| SLC-41 | $190k | 1,794 kN | full thrust | full thrust (just) | $30k |
| Starbase (2024: water plate) | $252k | 7,547 kN (3,510 without water) | full thrust | full thrust | $15k |
| SLC-4E | $137k | 1,591 kN | full thrust | 92 %, −5 m/s, 1 % damage, $10k | $21k |
| Gagarin's Start | $93k | 449 kN | 84 %, −11 m/s, 16 % damage, $200k | 92 %, 49 %, $280k | $22.5k |
| ELA-3 | $220k | 1,504 kN | full thrust | 92 %, −5 m/s, under 1 %, $5k | $37.5k |
| Wenchang LC-101 | $245k | 1,088 kN | full thrust | 92 %, 2 %, $35k | $30k |
| Yoshinobu LA-Y1 | $180k | 988 kN | full thrust | 92 %, 4 %, $65k | $30k |
| Rocket Lab LC-1 | $80k | 22 kN | 84 %, 50 %, $280k | 92 %, 50 %, $280k | $9k |

Every tail shape against every complex (the supervisor's grid, `spaceb-wave3/review2-pad/grid.mjs`): the solid-booster
tails of 2.2–3.1 MN (single + solids, Atlas V, Ariane 5, Shuttle, Titan II and New Glenn on Workhorse) overload SLC-40
and every smaller pad and launch at full thrust only from LC-39A or Starbase with water; the 1.4–2 MN tails fit SLC-40
and overload SLC-4E, ELA-3, Wenchang, Yoshinobu; Gagarin's Start and LC-1 take only small ships.

Fees are a tax, not a trade-off: option fees $5k–$65k, complex fees $8k–$50k (Starbase $140k: renting SpaceX's private
site and the biggest mount there is; a game value), kits $80k (LC-1) to $298k (LC-39A). Reliable and Workhorse launch
from SLC-40 ($172k): about $3.25M and $4.6M with the ship. Hold fees: $15k–$60k a day × the propellant loading's `holdF`
(1.0 by hand, 0.75 automatic top-off, 0.6 load-and-go: a hold costs what must be drained, boiled off and reloaded; game
values). One simple rule on purpose: the days already waited are charged at today's propellant option (`holdFee × day`),
so changing the loading after a HOLD re-prices those days too.

## Weather (weather.js)

- Climate of each complex: a January day (a northern-winter Mars window; summer at Mahia): `meanC`, `swingC` (day-to-day
  spread), `windKts`, `windSwingKts`, `lightning` (chance of lightning near the pad), `sky`. Approximate January normals,
  TODO verify each against the local climate tables: Cape 16 °C (highs about 22, lows about 10), Starbase 17, Vandenberg
  12, Baikonur −9.6, Kourou 27 (rainy season, frequent storms), Wenchang 18.7, Tanegashima 11, Mahia 18.
- Forecast: `meanC + anomaly`, the anomaly carrying over from day to day (`anomaly(d) = 0.6 · anomaly(d−1) + swing ·
  0.8 · noise`, an AR(1) chain; day-to-day temperature anomalies are strongly correlated, TODO verify 0.6).
- `actualC = forecastC + clamp(errorC · noise, ±2 · errorC)`. `errorC` from the weather watch: 3 °C (look at the sky),
  1.5 °C (balloons), 0.6 °C (radar and field mills). Real day-ahead temperature forecasts miss by about 1–2 °C.
- noise = a bell curve of four hashed uniforms (`fnv` + `mulberry32`) of complex id, day, `launch.seed` and a channel:
  the same save always gets the same weather; no random calls.
- `launch.forecast` = `{ day, tempC, windKts?, lightning?, label?, seed? }` fixes one day (Cold Morning: a 2 °C cold front
  on day 0). It belongs to one campaign: once `launch.seed` moves on (index.js after a flight) the climate rules again.
- HOLD: `launch.day + 1`. `holdFee` = complex.holdFee × propellant.holdF; `fee` = holdFee × day, paid at confirm.

Presets: Reliable, Workhorse and Thin Skin launch from SLC-40 on day 0 (23 °C). Cold Morning launches from SLC-40 with
every piece of equipment at its cheapest (a skimped pad, so its LOW_RELIABILITY stays) on a 2 °C cold front with no
weather watch: the actual temperature comes out at −4 °C, "below freezing on the pad" as the Cold Morning ending says.

## Real facts used (sources)

- LC-39A: 12 of 13 Saturn V launches, 82 of 135 Shuttle flights; trench about 137 × 18 × 13 m; STS-124 brick damage
  (NASA safety message "Hit the Bricks", Spaceflight Now, NASASpaceflight 2008); Falcon Heavy 6 Feb 2018; Demo-2 30 May 2020.
- SLC-40: 55 Titan launches 1965–2005, Falcon 9 since 4 June 2010, Amos-6 1 Sept 2016, 50 launches in 2023, Crew-9 Sept
  2024 (Wikipedia, Cape Canaveral SLC-40). Four lightning towers: TODO verify.
- SLC-41: clean pad, VIF 89 m (292 ft) about 550 m (1,800 ft) from the pad, rollout about a day before launch (ULA, CC
  Space Museum); Atlas V since 21 Aug 2002, Vulcan since 8 Jan 2024; Curiosity 26 Nov 2011, Perseverance 30 July 2020.
- Starbase: tower 146 m with chopsticks, 370 t table, twenty clamps, water-cooled steel plate after Flight 1, first booster
  catch 13 Oct 2024 (Wikipedia, SpaceX Starbase); Flight 1 crater and debris (AFP, SpaceNews, 2023; arXiv 2403.10788).
- SLC-4E: Atlas-Agena 1964, Titan to 2005 (68 launches), Titan 34D explosion 18 Apr 1986, Falcon 9 since 29 Sept 2013,
  LZ-4 since Oct 2018 (Wikipedia, Vandenberg SLC-4).
- Gagarin's Start: 15 May 1957 first launch, 520 launches to 25 Sept 2019, Soyuz T-10-1 fire 26 Sept 1983 (Wikipedia).
  Pit 250 × 100 × 45 m (EurasianTimes; another source says 35 m: TODO verify against russianspaceweb.com). The card
  says 45 m.
- ELA-3: 117 Ariane 5 launches 1996–2023, JWST 25 Dec 2021 (Wikipedia); 870 t launch table, 90 m water tower with
  1,500 m³, four 100 m lightning towers, three flame ducts (ESA, CNES, russianspaceweb.com). The Vulcain ran about 7 s
  on the pad before the boosters lit (widely reported; TODO verify the exact figure).
- Wenchang LC-101: finished 2014, Long March 5, Tianwen-1 23 July 2020, launch paths within 10 km of the coast (Wikipedia).
- Yoshinobu LA-Y1: early 1990s, H-II and H-IIA (last 28 June 2025), mobile launcher out about 12 h before launch, 30-minute
  move, block house 500 m away and 12 m underground, Hope 19 July 2020 (Wikipedia). 190 launch days a year until April
  2011 (the fishing agreement; TODO verify the month against JAXA).
- Rocket Lab LC-1: 2016 Pad A, Feb 2022 Pad B, 66 t platform and 7.6 t strongback (Rocket Lab). Licensed for a launch
  every 72 hours (the 30-year term is left out: TODO verify). Hold-down clamps on Electron's mount: TODO verify.
- Saturn V hold-down: start command at T−8.9 s, release after full thrust (several Apollo histories); Shuttle RSLS aborts
  (Wikipedia, Space Shuttle abort modes; NASA history); STS-1 overpressure (NASA NTRS 20205007677).

## Art

- `padArt(state, { radius, height, layout, icon, only })`: unchanged fitting rules (tower steps back from side parts,
  arms on part flanks, crew arm at the capsule, clamps under the lowest tank).
- Card pictures of the water and the clamps are close-ups with no pad under them: the water ring, its feed and blue spray
  (rainbird arcs and the water tower for the biggest option), a scorched patch for "no water"; the clamps around the
  base of a ship on its launch ring.
- New pieces: Starbase's raised mount (six legs, a heavy table, the steel water plate when there is water; its height
  follows the complex's `scale`), the integration tower with two catch arms passing either side of the ship near its
  top and a quick-disconnect arm, Gagarin's flame pit (a dark pit opening on one side between sloping earth banks) with
  the four support arms gripping the ship's base (opened out on an empty stand).
- Ground per complex from `climate.ground`; snow when the forecast is below 0 °C.
- Card pictures: `icon` draws a compact pad without ground or far-off gear, with a plain white rocket for a complex, and is
  scaled to 0.4 so the picture camera (far plane 100 m) sees all of it; `only: key` draws one piece of equipment on a bare
  slab (storage and weather gear close in; a windsock for "look at the sky").

## Requests to the lead

- Done by the lead: `stats.js` passes `g` and `wetMass`; designPage gives `ui.g` (the card's preview uses it).
- `tests/builder.test.mjs` presets block: it still prints and passes `launch.json`'s `slot` fee ($150k from the default
  `slot: 'mild'` of `cloneLaunch`); the real launch fee is `breakdown.launchFee` (SLC-40 kit: $172k).
- `assembly.js` (hull agent): `cloneLaunch` still adds `slot: 'mild', site: null` to every launch block; harmless.
- `bay/stations.js`: the `launchwindow` station's blurb still says "Pick the launch window: the soonest is cold and free".
- Money: even at $172k of fees a Reliable failure leaves about $890k, under the $1M insolvency floor (the failure
  penalty, 20 % of the ship + $250k, does most of it); fees alone cannot lift it over $1M.
- Card agent: `pad:<id>` entries now carry `vi.pros`, `vi.cons`, `vi.facts` and `equip:<key>/<option>` entries `vi.pros`,
  `vi.cons` (same order as section.json).
