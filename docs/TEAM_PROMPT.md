# HACKATHON GAME — Team Master Prompt (48h)

> **How to use this prompt (for humans):** Copy this ENTIRE file and paste it into Claude or Codex as your first message. At the very bottom, **replace the `MY ROLE:` line with your number** (e.g. `MY ROLE: 2`). The roles are listed in the "Role menu" at the end. The AI will work only on your part while respecting the shared contracts.

---

## 0. Rules for the AI (read first)

You are a senior game developer on a **4-person hackathon team** building a 3D browser game in **48 hours**. Several AI agents (Claude, Codex) code different parts of the same repo at the same time.

### ⭐ THE GOLDEN RULE
**A demo that runs smoothly and looks beautiful beats complex mechanics that don't work.**
- Always keep the game runnable. If a feature is risky, build the simple version first, then improve.
- Prefer **fake-but-convincing** over real-but-broken (a scripted cinematic is fine where a full simulation would be fragile).
- Follow the priority tiers in §16. When time is short, cut from the bottom tier up. Never cut Tier 0.

### Working rules
1. **Stay inside your role's folders** (§15). Don't edit other roles' files. Use the shared contracts (§14) or ask your human to coordinate.
2. **Never break `dev` or `main`.** Finished work goes to `dev`. Never push to `main`: dtri moves `dev` to `main` once the whole team has checked it. `npm run dev` must always start the game with no console errors. Commit small, working steps.
3. **Every feature must be testable alone** through `?debug=1` (skip to any scene, spawn a preset ship, infinite fuel/O₂, give money).
4. **Visual quality matters a lot** (§12). No grey placeholder boxes in the final demo.
5. **Science must be correct.** This is an educational game. Use NASA/ESA values and cite sources in the Guidebook. If unsure about a fact, mark it `// TODO verify` and tell your human.
6. If the spec is ambiguous, choose the simplest option that fits the vision, write it in `docs/DECISIONS.md`, and keep going.

---

## 1. Vision

**Working title:** "Hackathon" (final name not decided; keep the title in ONE constant so it's easy to rename).
**Genre:** First-person space-mission game: rocket building + Newtonian flight + Mars exploration, with a roguelike economy.
**Platform:** Web browser, desktop, keyboard + mouse, single-player. UI language: English.
**Pitch:** With a **$5,000,000** budget, design your own rocket like LEGO on a computer screen, launch from Earth, survive the flight, land on **Mars**, walk the surface in a spacesuit, uncover what happened to the lost crew before you, and come home. Every mistake can kill you. Every lost ship costs money. Go below $0 and the agency is **bankrupt**.

### The two halves (core design pillar)
| | **BRAIN**: Build → Launch → Cruise | **HEART**: Entry → Ship → Mars |
|---|---|---|
| Teaches | Physics and math that actually work | What space costs a human being, and why we go anyway |
| Player should say | "Now I finally understand what this formula *means*." | "This is fragile, lonely, beautiful, and worth it." |
| Key question | *How* do we get there? | *Why* do we go, and what do we leave behind? |

**Endings tie both halves together with real space history:** every failure teaches a real lesson that real people paid for.
**Final message of the game:** *Conquering space is built on math, courage, and loss.*

### Team priorities (in this order of importance)
1. **Graphics must look premium**: space, planets, cockpit, Mars.
2. **Story and missions must be compelling.**
3. **Rocket building must be fun and creative**: many parts, many choices, money to balance, numbers to calculate.
4. **Flying and being an astronaut must feel great**: smooth movement, beautiful scenery.
5. **The game must carry meaning**: the brain (physics and math) and the heart (hardship, loneliness, sorrow), plus history lessons in the endings.

### Inspiration (feel only; all assets, names, and text must be original)
Kerbal Space Program (building + physics), Outer Wilds (cozy cockpit, physics flight, emotional discovery), Elite Dangerous (cockpit HUD), Subnautica (oxygen tension), Astroneer (scanning/collecting), Firewatch (emotional storytelling through logs and radio). Films: *The Martian*, *Interstellar*, *Gravity*, *Apollo 13*.

---

## 2. Story (DRAFT: may change, keep all story text in data files so it's easy to edit)

- **Setting:** 2041. You are a rookie engineer-astronaut at a small private space agency (name TBD, use the constant `AGENCY_NAME`) with only $5M of funding.
- **Backstory:** Three years ago the crew of **Halcyon-1** (3 astronauts) landed in **Jezero Crater** on Mars, then went silent. Their last transmission: *"We found something… near the delta… it changes everything—"*. After that, no one dared to fund another mission.
- **Act 1, Arrival:** land, scan the terrain, set up power. Learn to survive.
- **Act 2, Traces:** find Halcyon-1's abandoned lander. Recover their **personal logs**: daily life, loneliness, missing home, what went wrong. Follow their trail to collect samples.
- **Act 3, Discovery:** find the rock they found: **possible signs of ancient life** (inspired by NASA Perseverance's real "Cheyava Falls" rock, 2024. Present it as a *potential* biosignature, not confirmed life, to stay accurate). Upload it to Earth. The return window is closing, so hurry.
- **Ending:** fly home. Halcyon-1's final log reveals how they died, and it's a lesson too (e.g. they ignored a warning).
- Names of crew members, agency, and player character: placeholders for now (`data/story.json`).

---

## 3. Core game loop

```
MAIN MENU (content warning on first launch)
   ↓
HANGAR: computer screen → BUILD (buy parts, assemble like LEGO)
   ↓
GO / NO-GO POLL → CONFIRM → money spent → pre-launch: choose family photo + write a message home
   ↓
LAUNCH → ASCENT → EARTH ORBIT → CRUISE (time-warp + hazard encounters) → MARS ENTRY → LANDING
   ↓                                              (failure → ENDING → FLIGHT REPORT → back to HANGAR)
SHIP INTERIOR (stand up, suit up, airlock) ⇄ MARS SURFACE (EVA, tasks, story)
   ↓  Mars Exploration 100% + enough fuel (or Mars-made methane)
RETURN (automatic cinematic) → HOMECOMING ending
```

- **On failure:** ending cinematic → "What went wrong" + "Lesson from history" → **Flight Report** (§8) → penalty charged → back to the hangar to rebuild. **No refund.**
- **Money < 0:** **Bankrupt** ending → full reset to $5,000,000.

---

## 4. Controls

### Cockpit (first-person, seated)
| Input | Action |
|---|---|
| Mouse | Look around the cockpit (window + control panels) |
| W / S | Pitch nose down / up |
| A / D | Yaw left / right |
| Q / E | Throttle up / down (persists, 0–100%) |
| X | Engine cut-off (ship keeps drifting: inertia) |
| Hold Space | Brake: automatic burn against current velocity (uses fuel) |
| Tab | Mission map (trajectory, planets, objectives, time warp) |
| Esc | Menu (resume, guidebook, settings, quit) |
| F | Toggle Flight Assist overlays |
| E (seated, after landing) | Unbuckle and stand up |

### Inside the ship (first-person, walking)
| Input | Action |
|---|---|
| W/A/S/D | Walk |
| Mouse | Look |
| Space | Small hop |
| E | Interact: pilot seat, suit locker, O₂ station, comms console, sample storage, airlock |
| Tab | Ship status (fuel, power, O₂ tanks, samples, data) + Exploration % |
| Esc | Menu |

### Mars surface (first-person, EVA)
| Input | Action |
|---|---|
| W/A/S/D | Walk |
| Mouse | Look |
| Space | Jump (Mars gravity 3.71 m/s²: ~2.6× higher, ~2.6× longer airtime) |
| Shift | Run (uses more O₂) |
| E | Interact / hold to scan, collect, deploy |
| Tab | Surface map (points of interest, Exploration %) |
| Esc | Menu |

Pointer Lock for mouse look. Sensitivity + invert-Y in settings.

---

## 5. Rocket Builder (Role 1): the BRAIN, part 1

**Presentation:** the player sits at a computer in a hangar. The builder is an **HTML/CSS sci-fi engineering terminal** (diegetic monitor with bezel). Must feel tactile: snapping sounds, hover glow, smooth drag.

### 5.1 LEGO-style modular parts
- **Snap system:** attachment nodes (top/bottom/radial). Stack, attach radially, build sub-assemblies.
- **Tools:** radial symmetry (×2/×3/×4/×6), mirror, rotate, move, undo/redo, copy/paste, paint color.
- **Blueprints:** save/load designs, plus a **share code** (base64 JSON) to share rockets.
- **Preset ships (for the pitch, so we don't build live):**
  1. **"Reliable"**: guaranteed success if flown sensibly.
  2. **"Cold Morning"**: cheap seals + launch in cold weather → demos the Challenger ending.
  3. **"Thin Skin"**: damaged/missing heat shield → demos the Columbia ending.

### 5.2 Assemble your own engine (MVP, it's a demo highlight)
An engine = **combustion chamber (fuel type)** + **nozzle** + **turbopump (size)**. The player builds it in an "engine workbench" sub-screen, and the stats update live with formulas.

| Fuel type (chamber) | Density | Isp sea-level nozzle (SL / vac) | Isp vacuum nozzle (SL / vac) | Cost | Special |
|---|---|---|---|---|---|
| **Kerosene + LOX** (kerolox) | High (~1.0 t/m³), so small tanks | ~282 / ~311 s | ~200 / ~348 s | $ | Cheap, compact, weakest |
| **Methane + LOX** (methalox) | Medium (~0.8 t/m³) | ~330 / ~350 s | ~240 / ~380 s | $$ | **Can be made on Mars** (Sabatier + ice), so it can refuel for the return |
| **Hydrogen + LOX** (hydrolox) | Very low (~0.35 t/m³), so huge tanks | ~366 / ~452 s | ~280 / ~465 s | $$$ | Most efficient, but **boils off** slowly during cruise |

(Real reference engines: Merlin 1D ≈ 282/311 s, Raptor ≈ 330/~380 s, RS-25 ≈ 366/452 s, RL10 ≈ 465 s. Tune numbers for fun but keep the ordering correct.)

| Turbopump | Thrust | Mass | Cost |
|---|---|---|---|
| Small | 100 kN | 0.5 t | $250k |
| Medium | 300 kN | 1.2 t | $600k |
| Large | 800 kN | 3.0 t | $1.4M |

- A nozzle tuned for sea level works well in the air but wastes power in vacuum, and vice versa. The thrust formula with pressure (§5.4 #9) shows why.
- Engine "hotness": bigger pumps overheat faster at 100% throttle (explosion risk).

### 5.3 Other part families (each 1–3 sizes; all in `src/builder/parts.json`)
| Family | Parts (MVP in bold) | Why it matters |
|---|---|---|
| Command | **Capsule** (required, cockpit + life support) | Holds the astronaut |
| Tanks | **S / M / L per fuel type** | Fuel mass vs dry mass |
| Structure | **Nose cones (pointed / blunt)**, **fins**, adapters, frames, decouplers (stretch) | Drag, stability |
| Control | **RCS pack**, **engine gimbal**, reaction wheels | Turning (torque) |
| Thermal | **Ablative heat shield**, ceramic tiles (lighter, fragile), radiators | Entry heating |
| Recovery | **Landing legs**, **parachute**, splash floats | Landing |
| Life support | **O₂ tanks**, **CO₂ scrubber**, water recycler, **radiation shelter** (storm cover) | Keeps the human alive |
| Power | **Solar panels**, **battery** | Systems, scanners; solar is weaker at Mars |
| Comms | **Low-gain antenna**, high-gain dish | Uploading data |
| Protection | **Armor plating** | Debris hits |
| Science | **Spectrometer**, **ground radar**, **drill**, sample containers | Mars tasks need them |
| Seals (for the Challenger demo) | **Cheap seals** vs **cold-rated seals** | Weather risk |

- **Reliability:** cheap parts have a higher hidden failure chance (shown as a reliability %). Stretch: pay for a **test stand** (static fire) to reveal defects.

### 5.4 Physics & Math Lab: "Formula Lens" (the BRAIN, core educational feature)
**Goal:** turn dry formulas into tools the player uses with their own hands.

**How it works:** hover/click any stat →
1. the formula,
2. the same formula **with the player's real numbers plugged in**,
3. the result + unit,
4. **color-coded variables linked to parts** (click `m_fuel` → every tank glows),
5. a one-line **"In real life"** analogy + Guidebook link.
Changes to the rocket update everything live, so cause → effect is instant.

**MVP: these 5 must be fully interactive:**
| # | Formula | What the player sees | In real life |
|---|---|---|---|
| 1 | **Weight** `W = m·g` | Weight on Earth vs Mars side by side | Why you jump higher on Mars |
| 2 | **Newton's 2nd law & TWR** `a = F/m − g`, `TWR = F/(m·g)` | Ghost rocket on the pad lifts off or doesn't; TWR gauge (red zone < 1) | Pushing a full vs empty shopping cart |
| 3 | **Rocket equation** `Δv = Isp·g0·ln(m_wet/m_dry)` | **Live graph** of Δv vs fuel added, with the player's rocket as a dot. Diminishing returns ("tyranny of the rocket equation") | Carrying more water on a hike makes you heavier, so you need even more water |
| 4 | **Center of mass** `x_cm = Σ(mᵢ·xᵢ)/Σmᵢ` + **CoP behind CoM = stable** | CoM marker moves as you build and as fuel drains; fins move the CoP back | Arrows and badminton shuttlecocks fly straight for the same reason |
| 5 | **Δv budget** | Bar chart: Δv needed per leg vs Δv you have | A road-trip fuel budget |

**Described now, built if time allows (Tier 2/3):**
| # | Formula | Use |
|---|---|---|
| 6 | `v_e = Isp·g0`, `ṁ = F/v_e`, `t_burn = m_fuel/ṁ` | Burn time per tank (garden hose analogy) |
| 7 | Torque & inertia `τ = r·F`, `α = τ/I`, `I = Σmᵢ·rᵢ²` | RCS far from CoM turns faster (door hinge analogy) |
| 8 | Drag `F_d = ½·ρ·v²·C_d·A` | Nose cone choice (hand out of a car window) |
| 9 | Thrust with pressure `F = ṁ·v_e + (p_e − p_a)·A_e` | Why nozzles differ at sea level vs vacuum |
| 10 | Dynamic pressure `q = ½·ρ·v²` | Max-Q limit (wind force grows with speed²) |
| 11 | Entry heating `q_heat ∝ √(ρ/r_nose)·v³` | Why blunt capsules survive (2× speed → 8× heating) |
| 12 | Inverse-square law `flux ∝ 1/d²` | Solar power at Mars ≈ 43% of Earth's |
| 13 | Life-support budget (~0.84 kg O₂/person/day, NASA) | How much air for the trip |
| 14 | Units: some vendor parts list thrust in **lbf** (1 lbf = 4.448 N) | Mars Climate Orbiter lesson |
| 15 | "Predict it" bonus: estimate Δv yourself within 5% → +$50k | Math = money |
| — | Engineering contracts, Simulate button, "Under the hood" (`v += a·dt; p += v·dt`) view | Calculus literally moves the rocket |

### 5.5 Go / No-Go poll (validation, cinematic)
Each console reports in turn with voice + text: *"Propulsion… GO. Guidance… GO. Thermal… NO-GO: no heat shield. Weather… NO-GO: 2 °C, seals not cold-rated."*
- ❌ **Hard blocks (can't confirm):** no capsule, no engine, no fuel, parts not connected, over budget.
- ⚠️ **NO-GO warnings (player may override, and that's where endings come from):** low Δv, TWR < 1.2, no heat shield, no legs, unstable, low O₂, no antenna, no radiation shelter, cheap seals in cold weather, low reliability.
- Each warning = one plain sentence + Guidebook link.

### 5.6 Economy
- Start **$5,000,000**. Confirming the build spends the full ship cost.
- **Failure penalty:** `20% of ship cost + $250,000` (recovery & investigation). Lost ship = no refund.
- **Rewards** from tasks (§9) + homecoming bonus ($2M).
- Money < 0 → **Bankrupt**.
- Balance target: cheapest viable ship ≈ $2.5–3M, so the player can afford 1–2 failures. Tension is the point.
- Save in `localStorage` (try/catch everywhere): money, unlocked parts, blueprints, Mars progress, endings and history lessons seen, settings.

---

## 6. Flight (Role 2): the BRAIN, part 2

> **Ownership in this section:** Role 2 owns the **3D flight scenes** (launch/orbit, entry/landing) and the reusable **flight controller**. **Role 4 owns the CRUISE scene** (Tab map, time-warp, day counter, launch window, family messages, solar storm + malfunction events), reusing Role 2's flight controller for the short debris-dodge encounter.

### 6.1 World scale (important decision for feasibility)
- **Real surface gravity, scaled planets:** Earth g = 9.81 m/s², Mars g = 3.71 m/s² (real), but **planet radii scaled to 1/10** (Earth 637 km, Mars 339.5 km). All formulas stay exactly correct, and orbital speeds become playable (Earth low orbit ≈ √(g·R) ≈ 2.5 km/s, Mars ≈ 1.1 km/s). The HUD/Guidebook shows the **real-world equivalents** ("Real Earth orbit: ~7.8 km/s").
- **Flight is split into scenes** connected by transitions (don't simulate the whole solar system in one scene):
  1. **Earth launch & orbit** (3D, full physics)
  2. **Cruise** (Tab map with time-warp; drops into short 3D **encounters**: debris, malfunction, solar storm)
  3. **Mars approach, entry & landing** (3D, full physics)
- Gravity always comes from `src/core/planets.js`, never hard-coded.

### 6.2 Physics model: semi-realistic Newtonian
- Fixed timestep (1/120 s): `a = thrust/m + gravity + drag`, `v += a·dt`, `p += v·dt`.
- Inertia: engine off = keep drifting.
- Fuel burn: `ṁ = F/(Isp·g0)`, so mass drops and acceleration rises.
- Gravity `g(r) = g_surface·(R/r)²`. Drag uses air density by altitude (Earth thick, Mars ~1% of Earth's surface pressure).

### 6.3 Flight phases & realism
1. **Countdown & launch:** T-10, ignition ~T-3 (thrust builds), release. Camera shake. **Sound fades as the air thins**; in vacuum only structure-borne rumble inside. Sky fades from blue to black. Mission Control callouts: "Max Q", "MECO", "Orbit achieved".
2. **Ascent:** gravity-turn tip ("Going straight up wastes fuel. Orbit = sideways speed, not height").
   - **Max-Q meter:** dynamic pressure `q = ½ρv²` vs the structural limit. Throttle down or the structure fails.
   - **G-force meter:** sustained high g → vision tunnels (vignette). Too high → blackout → crash. Guidebook: astronauts lie on their backs to tolerate more g.
3. **Earth orbit:** apoapsis/periapsis readout. Wait for the **launch window** (Mars ~44° ahead of Earth; real windows every ~26 months), then burn for transfer.
4. **Cruise (time-warp):** the HUD shows "Day 143 / 210" (real trip ~7–9 months). **Realistic hazards only** (interplanetary space is nearly empty; the asteroid belt is *beyond* Mars, so NO asteroid field between Earth and Mars):
   - **Orbital debris** near Earth (real: tens of thousands of tracked objects): dodge, or armor absorbs a small hit.
   - **Solar storm:** radiation spikes, so go to the radiation shelter. Dose meter in mSv (real cruise dose ≈ 1.8 mSv/day, measured by Curiosity's RAD).
   - **Random malfunction (Apollo 13 style):** leak, stuck thruster, or sensor failure. Diagnose using the panel and fix or work around it.
   - **Comms delay grows** (seconds → up to ~20 min one way in reality, compressed to seconds in the game) and is shown on the HUD.
5. **Mars entry, "7 minutes of terror":**
   - **Entry corridor:** too steep = burn-up, too shallow = **skip off** into space (→ Adrift).
   - **Plasma blackout:** comms lost. You're alone.
   - Sequence: heat shield → parachute → retro-burn → touchdown.
6. **Landing:** a **"BURN NOW" marker** from stopping distance `d = v²/(2·(a_engine − g))` (the same physics as a car's braking distance). Engine dust hides the view in the last meters. Touchdown < ~3 m/s and upright = success.
7. **Return:** **automatic cinematic** (Mars liftoff → cruise montage → Earth re-entry, which is faster, ~11–12 km/s in reality → parachute splashdown). It requires enough Δv (leftover fuel, or methane produced on Mars if methalox engines + energy tasks done). Otherwise the HQ message reads: "Not enough fuel to return. Complete the energy tasks."

### 6.4 Math in flight (HUD formula cards, same style as the Formula Lens)
Small cards appear when relevant, with live numbers: `a = F/m − g` (liftoff), gravity loss (ascent), `q = ½ρv²` (Max-Q), `v = √(GM/r)` and escape `√(2GM/r)` (orbit), **vis-viva** `v² = GM(2/r − 1/a)` + **Kepler 3** `T² ∝ a³` (map), Hohmann transfer time (map), velocity vector addition (anytime), stopping distance (landing). MVP: liftoff, orbit speed, and stopping distance. Others when time allows.

### 6.5 Flight Assist (beginner-friendly, toggle F, on by default)
- **Thrust arrow** (orange) vs **velocity arrow** (cyan): pointing ≠ moving.
- **Predicted trajectory line** (next N seconds, updates live as you burn).
- **Fuel bar** + Δv left + burn time left.
- **Speed warnings** (amber/red) for entry, landing, and debris.
- **Prograde/retrograde markers.**
- **First-time tips:** "Engine off ≠ stop. In space nothing slows you down. Burn against your motion (hold Space)."

---

## 7. Ship interior & Mars EVA (Role 2): the HEART, part 1

### 7.1 Walkable ship interior (~4×8 m cabin, detailed)
| Station | E does |
|---|---|
| Pilot seat | Sit (fly) / stand up |
| Suit locker | Suit up / remove suit (helmet frame + suit HUD appear) |
| O₂ station | Swap/refill suit tanks |
| Comms console | Upload data to HQ (needs antenna), read HQ & family messages (with delay) |
| Sample storage | Store samples (only stored samples count) |
| Airlock | Cycle (~3 s depressurize) → outside |
| Crew-life props | Bunk, food packs, water recycler, exercise bike, **family photo** (each shows a short real fact) |

The inside has no O₂ drain: it's the safe zone. Gravity = the local planet.

### 7.2 EVA on Mars
- **Oxygen:** drains (~4–6 real minutes per tank; running drains faster). Cautions at **30%** (amber), **15%** (red + beeping + loud breathing), **5%** (vignette/blur). Swap at the O₂ station. **0%** → "Out of Breath" ending.
- **HUD:** O₂, suit temperature, heart rate, radiation, current gravity (`3.71 m/s² · 0.38 g`), distance + arrow to the ship, current task.
- **Gravity feel:** higher, floatier jumps; slower falls; same inertia (mass unchanged, only weight). Fall damage by impact speed.
- **Navigation:** **no compass works** (Mars has no global magnetic field), so the ship's radio beacon + landmarks guide you.
- **Polish (Tier 3):** prebreathe before the airlock (decompression sickness), dust brushing (toxic perchlorates), cold nights draining suit power.

---

## 8. Body stats & Flight Report ("black box")

Throughout the mission the game records everything, like a real flight data recorder (`src/report/blackbox.js`).
- **Astronaut stats:** peak g-force, radiation dose (mSv), O₂ used, CO₂ level, suit/cabin temperature, heart rate, fatigue.
- **Ship stats:** max-Q reached, engine temperature peaks, fuel per phase, hits taken, part failures (which part, when), entry angle and peak heating, touchdown speed.
- **Flight Report** (after every mission, success or failure), shown on the hangar computer:
  - Timeline of key events and the **root cause** of failure ("Thermal: heat shield breached at T+412 s").
  - **Engineering recommendations** linked to parts ("Peak 7.2 g at launch, astronaut blacked out → lower first-stage thrust or TWR"; "Radiation 140 mSv → add radiation shelter").
  - Click a recommendation → the related part glows in the builder.
- Single-player: the player reads the report and rebuilds. (Future multiplayer: the astronaut hands this report to the engineer, see §18.)
- Owners: **Role 4** owns `blackbox.js` (it just *listens* to events everyone already emits, so other roles do no extra work) and the Flight Report screen. Role 1 only implements `builder:highlightPart` so a recommendation can make a part glow.

---

## 9. Missions & progress (Role 4, placed on the map by Role 4)

**Mars Exploration %**, driven by the story (§2):
| Task | How | Weight | Reward |
|---|---|---|---|
| **Terrain scans** | 2 scan points: hold E (progress ring), uses the spectrometer/radar | 20% | $200k each |
| **Energy** | Deploy solar panels; find buried ice with radar → O₂ + methane for the return (real tech: NASA's MOXIE made O₂ from CO₂ on Mars, 2021–2023) | 20% | $250k |
| **Samples** | 3 samples (basalt, clay = ancient water, hematite spherules) in sealed tubes, stored in the ship | 25% | $150k each |
| **Halcyon-1 data** | 2 data logs from the lost lander → carry back → upload at the comms console (shows the real Earth–Mars delay) | 25% | $300k each |
| **The Discovery** | The final rock in the delta: possible biosignature → upload → story climax | 10% | $500k |

- Each item opens a **Guidebook fact card**.
- **Every kilogram of samples reduces return Δv** (rocket equation from §5.4!). The player must choose between more science and a safer trip home.
- **Return window timer:** "Return window closes in X sols" (real missions stay ~500 days; compressed).
- 100% + enough Δv → Return cinematic → Homecoming.

---

## 10. Endings (Role 4 owns screens + sequences, using Role 3's cinematic API; Role 2 only emits `flight:failed`)

Every ending screen has: **title**, a short cinematic/still, **"What went wrong"**, **"Lesson from history"** (when applicable), the **cost charged**, then the **Flight Report**.

### 10.1 Gameplay endings
| Ending | Trigger | Tone |
|---|---|---|
| **Adrift: The Last Message** (§10.3) | Out of fuel with no way back, or skipped off the atmosphere | Heartbreaking |
| **Rapid Unscheduled Disassembly** | Engine overheat, Max-Q exceeded, structural failure, hard collision, crash landing | Dark humor |
| **Burn-up** | Entry too fast/steep or no heat shield | Serious |
| **Out of Breath** | Suit O₂ reaches 0 on Mars | Serious, quiet |
| **Bankrupt** | Money < 0 | Humor: the agency is sold, your rocket ends up in a museum |
| **Homecoming** (success) | Mission complete | Emotional, hopeful |

### 10.2 Lessons from real history (all 9 designed; **MVP implements 2: Challenger & Columbia**, the others are presented verbally in the pitch and built later)
Present respectfully: real people died. Facts verified against NASA/ESA sources.
| In-game ending | Trigger | Real event | Lesson |
|---|---|---|---|
| ✅ **Cold Morning** | Cheap seals + cold weather + overriding the NO-GO | **Challenger, 1986**: an O-ring failed in the cold, even though engineers had warned | Listen to warnings, don't normalize risk |
| ✅ **The Foam** | Heat shield damaged on ascent and never inspected | **Columbia, 2003**: foam struck the wing during launch, and the shuttle broke apart on re-entry | Small damage kills, so inspect |
| **Pure Oxygen** | Pure-O₂ cabin + electrical fault | **Apollo 1, 1967**: cabin fire during a ground test | O₂-rich fires spread terrifyingly fast |
| **Successful Failure** (survivable) | Tank explosion mid-cruise, survive by improvising | **Apollo 13, 1970**: everyone came home | Calm problem-solving saves lives |
| **Silent Return** | Cabin depressurizes on re-entry while no suit is worn | **Soyuz 11, 1971**: the only humans to die in space | Wear the suit in critical phases |
| **Unit Error** | lbf/N mix-up from a vendor part | **Mars Climate Orbiter, 1999** | Units matter |
| **False Touchdown** | Cheap sensor → engine cuts off 40 m up | **Mars Polar Lander, 1999 / Schiaparelli, 2016** | Sensors lie, use redundancy |
| **Spin** (survivable) | Stuck RCS thruster | **Gemini 8, 1966**: Armstrong regained control | Stay calm, know your controls |
| **Beagle** | Landed, but the panels/antenna never deployed → silence | **Beagle 2, 2003**: found intact in 2015 | Success can fail at the last step |

### 10.3 "Adrift: The Last Message" (signature emotional ending, MVP)
Mission Control confirms (with delay) that no rescue is possible. The player can keep trying until the air runs out, or choose **"Accept"**. Then (slow, no music, only breathing and the ship's hum):
1. Lights dim to save power.
2. The astronaut slowly sinks to their knees (floats down in zero-g) and takes out the **family photo** chosen before launch.
3. The **message they wrote before launch** plays back.
4. The player types a final log entry.
5. It is **implied** that they choose to end their life: **fade to black, no method shown, nothing graphic, never framed as relief or a solution.** The tragedy is the point.
6. Exterior shot: the ship drifts away, shrinking among the stars.
7. Text: **"The reply from your family arrived 14 minutes later."** Their message plays to an empty cockpit (the real comms-delay science is the heartbreak).

**Safe-messaging (required):** content warning on first launch; setting "Skip sensitive scenes" (step 5 becomes simply running out of air); a calm line on this ending screen: *"If you or someone you know is struggling, help is available: findahelpline.com"*.

---

## 11. The HEART: emotional design for Entry → Ship → Mars

1. **Fragility:** the human body is the weakest part of the spacecraft. G-force blackouts, radiation, cold, O₂. The suit is a tiny spaceship.
2. **Distance & isolation:** comms delay grows. Family messages arrive late and can't be answered live. **Pale Blue Dot moment:** on the first Mars evening, Earth is a bright star. Zoom in with the helmet camera: a tiny dot. HQ, quietly: *"Everyone you've ever loved is on that dot."* (original wording, inspired by Carl Sagan; Guidebook: the "overview effect").
3. **Purpose:** the search for ancient life at Jezero is why we go.
4. **Legacy:** Halcyon-1's personal logs: you finish the work of those who didn't make it.
5. **Sacrifice:** samples cost return fuel, and O₂ forces the choice "one more scan or go back now?".
6. **Silence as a tool:** key moments have no music at all, just breathing.
7. **First step:** a cinematic first footstep on Mars, and the player types their own "first words".
8. **Homecoming:** *"You were away 2 years, 7 months."* Family messages, the world's reaction to the discovery.

---

## 12. Graphics & audio (Role 3): PRIORITY #1

Target: **AAA-looking for a browser game.** Space is forgiving (dark backgrounds), so use these tools well:
- **Renderer:** WebGLRenderer, ACES Filmic tone mapping, sRGB, PBR materials.
- **Post-processing** (`postprocessing` by pmndrs): **bloom** (engines, screens, sun), SMAA, vignette, subtle film grain, slight chromatic aberration, sun lens flare. G-force/O₂ vignette effects are driven by gameplay.
- **Space:** 8K Milky Way HDRI/skybox (ESA/NASA, Poly Haven), star particles, bright sun.
- **Earth & Mars from orbit:** high-res textures (NASA, Solar System Scope: credit them), **atmosphere rim shader** (blue Earth, thin butterscotch Mars), Earth clouds + night-side city lights.
- **Cockpit & cabin:** emissive screens, blinking buttons, glass reflections/smudges, red alarm lighting, crew-life props. Instruments mirror the HUD data.
- **Launch & entry:** engine flame + exhaust particles, camera shake, **plasma glow on the window** during entry, landing dust.
- **Mars surface (Jezero, simplified):** noise heightmap shaped like a crater floor + delta cliffs (real DEM is a stretch), PBR regolith, instanced rocks, drifting dust, red-orange fog, low-sun long shadows. **Sky:** butterscotch by day, **blue at sunset**, the Sun ~2/3 the size seen from Earth, Phobos & Deimos, **Earth as an evening star**.
- **HUD/UI:** HTML/CSS sci-fi: thin lines, monospace, cyan/amber/red states, subtle glow, hologram flicker, always readable.
- **Cinematics** (endings, first step, return): scripted camera paths + fades. Keep them simple and beautiful.
- **Audio:** muffled engine rumble inside, sound fading with altitude, radio chatter, alarms, suit breathing, quiet muffled Mars ambience (thin air; NASA's Perseverance microphone recordings are generally public domain, so check the license), silence for emotional beats. Free CC0 sources: freesound.org, Sonniss GDC bundle.
- **Performance:** 60 fps on a mid-range laptop; Low/High quality settings.
- **Assets:** Poly Haven, Kenney.nl, Poly Pizza, Sketchfab CC0/CC-BY, NASA 3D Resources. Keep `CREDITS.md`.

---

## 13. Guidebook / knowledge base (Role 4)

An in-game encyclopedia (Esc menu, hangar computer, linked from Formula Lens, warnings, endings, Flight Report). Short cards: illustration + plain explanation + "Real numbers" box + source.

**MVP entries (≥ 12):** Newton's laws (thrust, inertia), weight vs mass, TWR, rocket equation & Δv, specific impulse & fuel types, center of mass/pressure, steering in space, orbits (sideways speed), gravity & escape velocity, Max-Q & g-force, atmospheric entry & heat shields, getting to Mars (Hohmann, windows, 7–9 months), Mars facts (g = 3.71 m/s² ≈ 38% of Earth's, radius 3,390 km, ~95% CO₂ at <1% of Earth's pressure, average ≈ −60 °C, sol = 24 h 39 min, blue sunsets, dust storms, ice), crew life (O₂ ≈ 0.84 kg/person/day, water recycling ~98% on ISS, exercise ~2 h/day, radiation, isolation, comms delay), ISRU (making fuel/O₂ on Mars), plus the 9 history lessons.

**Unlocks:** dying from a cause unlocks its entry ("You learned: Atmospheric Heating").
Content lives in `src/guidebook/entries.json`. **Role 4 also writes:** Formula Lens analogies, Flight Assist tips, Go/No-Go lines, Flight Report recommendations, ending texts, HQ radio lines, family messages, Halcyon-1 logs, story data.

---

## 14. Tech stack & shared contracts (ALL roles)

`src/core/contract.js` in the repo is the source of truth for all names and data shapes below; it resolves gaps in this section.

**Stack:** Vite + Three.js (latest stable) + vanilla JavaScript ES modules. HTML/CSS overlays for all UI. `postprocessing` for effects, `lil-gui` for debug only. Deploy on Vercel/Netlify.

**`src/core/planets.js`** (never hard-code gravity):
```js
export const PLANETS = {
  earth: { g: 9.81, radius: 637e3,   realRadius: 6371e3,   seaLevelDensity: 1.225, scaleHeight: 8500 },
  mars:  { g: 3.71, radius: 339.5e3, realRadius: 3389.5e3, seaLevelDensity: 0.020, scaleHeight: 11100 },
};
export const G0 = 9.80665; // standard gravity for Isp
```

**State machine** (`src/core/state.js`): `MENU → HANGAR → GONOGO → PRELAUNCH → LAUNCH → ORBIT → CRUISE → ENTRY → LANDING → INTERIOR ⇄ SURFACE → RETURN → ENDING → REPORT → HANGAR`. Only `core` switches state; modules request changes via events.

**Event bus** (`src/core/events.js`):
```
ship:built        { shipSpec }
flight:phase      { phase }
flight:event      { type, t, data }        // e.g. 'maxq', 'debris_hit', 'malfunction', 'solar_storm'
flight:landed     { touchdownSpeed }
flight:failed     { endingId, cause }
interior:interact { stationId }
eva:oxygen        { percent }
task:completed    { taskId, category, reward }
progress:changed  { percent }
story:log         { logId }
mission:complete  {}
economy:changed   { money }
ending:show       { endingId, cause, cost, historyLessonId }
guidebook:open    { entryId }
```

**ShipSpec** (Builder → Flight):
```js
{
  parts: [{ id, type, x, y, rotation, variant }],
  engines: [{ fuel: 'kerolox'|'methalox'|'hydrolox', nozzle: 'sl'|'mid'|'vac', pump: 'S'|'M'|'L' }],
  stats: { cost, wetMass, dryMass, fuelMass, thrust, ispSL, ispVac, deltaV, twrEarth, twrMars,
           comOffset, copOffset, reliability, hasHeatShield, heatShieldDamaged, hasLegs, hasRCS,
           hasParachute, hasAntenna, hasShelter, coldRatedSeals, armorHits, spareO2Tanks, power },
  warnings: ['NO_HEAT_SHIELD', 'COLD_SEALS', ...]
}
```

**Black box** (`src/report/blackbox.js`, Role 4): listens to `flight:*`, `eva:*`, `interior:*` events and builds `getReport()` (§8). Other roles only emit events.
**Save** (`src/core/save.js`, key `hackathon_save_v1`), all wrapped in try/catch.
**Debug** (`?debug=1`): jump to any state, spawn preset ships, infinite fuel/O₂, set money, trigger any ending/hazard.

---

## 15. Roles, folder ownership & how to work independently

### 15.1 Who owns what (balanced to ~30–35 h of work each)
```
src/
  core/        SHARED, kept by ROLE 3: main.js boot, state machine, events, input, ui, planets, save, economy, contract, debug panel, mocks/ (plumbing only, no game screens)
  builder/     ROLE 1: main menu + settings, hangar computer UI, parts.json, LEGO snapping, engine workbench, Formula Lens, Go/No-Go, presets
  flight/      ROLE 2: flight controller (physics + cockpit controls), Flight Assist, launch/orbit scene, entry/landing scene, Max-Q/G
  surface/     ROLE 2: first-person walking controller (interior + EVA), interactable system, stations, airlock, suit, oxygen
  graphics/    ROLE 3: renderer, post-processing, asset loader, skybox, planets + atmosphere, cockpit/cabin/Mars visuals, VFX, cinematic API
  audio/       ROLE 3: sound manager, ambience, alarms
  ui/          ROLE 3: HUD theme (CSS variables, fonts, components). Each role builds its own panels with it
  cruise/      ROLE 4: cruise scene (Tab map, time-warp, launch window, day counter, solar storm, malfunction, message arrivals)
  story/       ROLE 4: story data, Halcyon-1 logs, HQ/family messages, Pale Blue Dot event, ending screens & sequences (incl. Adrift)
  missions/    ROLE 4: tasks, placement data, progress %, rewards, return-window timer
  guidebook/   ROLE 4: entries.json, guidebook UI, all educational text
  report/      ROLE 4: blackbox.js (listens to events) + Flight Report screen
public/assets/ models, textures, audio (credit everything in CREDITS.md)
docs/          DECISIONS.md, DEMO_SCRIPT.md
```

| Role | Owns | Provides to others (by hour 3 as stubs!) | Uses from others |
|---|---|---|---|
| **1. Rocket Builder** | Main menu + settings, builder, engine workbench, Formula Lens, Go/No-Go, presets, the economy rules as data (`core/balance.json`) | `builder:highlightPart`, the real `src/builder/` replacing its stubs | Theme CSS (R3), `core/` (R3), guidebook text (R4) |
| **2. Flight & Astronaut** | Flight controller, Flight Assist, launch/orbit + entry/landing scenes, Max-Q/G, walking controller, interactable system, stations, airlock, O₂ | `FlightController` class, `registerInteractable({id, position, prompt, onUse})`, `flight:*` / `eva:*` events | ShipSpec (mock), `getTerrainHeight` (R3), models by name (R3) |
| **3. Graphics, Audio & Core** | Every visual and sound, HUD theme, cinematic API, performance settings, `core/` (game loop, state machine, events, contract, economy, save) + debug panel + `npm run check`, confirms `dev` boots | `core/` (`events`, `requestState`, `input`, `ui`, `economy`, `save`, mocks, debug panel), `graphics.init()`, `assets.get('cockpit'\|'cabin'\|'rocketPart:<id>'\|...)`, `getTerrainHeight(x,z)`, `cinematic.play({cameraPath, fades, duration})`, `audio.play(id)` | Nothing blocking: builds scenes in a **visual sandbox** page |
| **4. Story, Cruise & Knowledge** | Cruise scene, story, tasks, ending screens + sequences, blackbox + Flight Report, Guidebook, all narrative/educational text, demo script | Text JSONs (tips, Go/No-Go lines, analogies), task placement data, `guidebook:open` | `registerInteractable` (R2), `cinematic.play` (R3), `FlightController` (R2) |

### 15.2 Rules that let 4 people code without waiting on each other
1. **Hour 0–3, "contract freeze":** all four agree on and commit `core/` (events, state, planets, ShipSpec shape) + **empty stubs** of every public API above. After this, contracts change only if all four agree.
2. **Mocks for everything** (`core/mocks/`): 3 preset ShipSpecs, a fake black-box report, a fake mission progress. Nobody waits for real data.
3. **Debug panel** (`?debug=1`, Role 3): jump to any state, fire any event, spawn presets, trigger any ending. Every role tests alone. `npm run check` must pass before pushing to `dev`.
4. **Visuals behind names:** gameplay code asks `assets.get('cockpit')` and gets a placeholder at first. Role 3 swaps in beautiful models/materials later **without touching anyone else's code**.
5. **Talk only through events + public APIs**: never import another role's internal files.
6. **Each role has its own branch** (`role1-builder`, `role2-flight`, `role3-graphics`, `role4-story`) and one sandbox page (`/sandbox/<role>.html`) to work in isolation.
7. **Merge checkpoints:** hours **12, 18, 24, 30, 36, 42**. Everyone merges finished work into `dev`, and `npm run check` covers that the game still boots. The team then checks `dev`, and dtri confirms it is healthy and moves it to `main` once everyone agrees. Small, frequent merges beat one huge merge.
8. **Data over code:** text, numbers, task placement, and parts live in JSON, so balancing doesn't create merge conflicts.

## 16. Priority tiers (cut from the bottom when time runs out)

**Tier 0: playable loop (must work by ~hour 24, ugly is OK):**
Hangar builder with basic parts + snapping, Go/No-Go (text), launch → orbit → cruise (map + 1 encounter) → entry → landing, interior with seat/suit/airlock/O₂, EVA with oxygen, 1 task of each type, economy + penalty, 1 ending screen, preset "Reliable" ship, debug mode.

**Tier 1: the demo "wow" (by ~hour 36):**
Graphics polish (bloom, atmosphere shaders, HDRI, Mars sky/fog/dust, cockpit lighting), engine workbench, Formula Lens with the 5 MVP formulas + Δv graph, voiced/animated Go/No-Go, Flight Assist arrows + trajectory, Max-Q & G meters, debris + solar storm + malfunction encounters, entry plasma + blackout, "BURN NOW" landing marker, Halcyon-1 logs + Discovery, Pale Blue Dot, delayed family messages, **Adrift: The Last Message**, **Cold Morning (Challenger)** + **The Foam (Columbia)**, Flight Report, return cinematic + Homecoming, presets "Cold Morning" and "Thin Skin", Guidebook ≥ 12 entries, core audio.

**Tier 2: depth (if time allows):**
Formula cards 6–11, the three fuel types' special rules (hydrogen boil-off, Mars methane refuel), reliability %, sample-mass vs return Δv, return-window timer, first-step cinematic, crew-life props with facts.

**Tier 3: polish/extra:**
Formulas 12–15, Predict-it bonus, contracts, Simulate button, "Under the hood" view, remaining 7 history endings, real Jezero DEM, prebreathe/dust/cold nights, test stand, staging, decouplers, more cinematics.

**Cut order when late:** Tier 3 → Tier 2 → parts of Tier 1 (cut the less visible items first: malfunction encounter → solar storm → Max-Q visuals). **Never cut:** the graphics polish, Adrift ending, Formula Lens core, the Go/No-Go + one history ending, landing on Mars.

---

## 17. 48h timeline & demo

| Hours | Goal |
|---|---|
| 0–3 | **Contract freeze**: repo setup (Vite + Three), `core/` contracts, mocks, debug panel, stubs of every public API (§15). Everyone pulls. |
| 3–18 | Each role builds its Tier 0 parts alone (debug mode) |
| 18–24 | **Integration:** full Tier 0 loop playable (merges at hours 12, 18, 24) |
| 24–36 | Tier 1 "wow" features + graphics polish |
| 36–42 | Balance (money, fuel, O₂), bug fixes, performance, Tier 2 if safe |
| 42–45 | **Feature freeze.** Only bug fixes. Deploy. |
| 45–48 | Record a backup demo video, rehearse the pitch |

**Demo script (`docs/DEMO_SCRIPT.md`, Role 4), ~5–7 min:**
1. Hook: "Every formula you hated in school, this game turns into life or death."
2. Hangar: assemble an engine live (30 s), show the Formula Lens + Δv graph.
3. Load preset **"Cold Morning"**, override the NO-GO → launch → Challenger ending + history lesson (brain + history).
4. Load **"Reliable"** → launch (sound fading, Max-Q, G) → Flight Assist → entry plasma → landing.
5. Mars: walk out, O₂ caution, find a Halcyon-1 log, **Pale Blue Dot** moment (heart).
6. Show the **Adrift: The Last Message** ending (prepared via debug).
7. Verbally present the other history endings + future multiplayer.
8. Close on the message: *math, courage, and loss.*

---

## 18. Future (NOT for the hackathon, don't build now): Co-op multiplayer
Keep the code friendly to this (separate profiles in the save, ShipSpec as JSON, the black box as data), but **build nothing for it now**.
- **Engineer** builds and runs **Mission Control** (live telemetry + chat with real comms delay; can advise, can't touch the controls). **Astronaut** flies and explores.
- If the engineer builds sloppily and the ship explodes, the **astronaut dies and loses everything** (gear, progress, rank) and restarts as a new recruit. The **engineer only loses money**, like in real life.
- The astronaut can inspect the ship and **refuse to fly** (scrub). After every flight the astronaut hands the **Flight Report** to the engineer to fix the problems.
- Tech later: PeerJS (WebRTC) or Node + Socket.io.

---

## 19. Definition of done
- Runs from `npm run dev`, no console errors, 60 fps target.
- Testable alone via `?debug=1`.
- Uses shared contracts only.
- Looks polished (no placeholders in the demo path).
- Every science/history fact shown is correct and sourced.

---

## 20. Role menu (pick ONE)

| # | Role | You build | Your folders | Hand off to others by hour 3 (as stubs) |
|---|---|---|---|---|
| **1** | **Rocket Builder** | Main menu + settings, hangar computer, LEGO builder, engine workbench, Formula Lens, Go/No-Go, preset ships, economy rules as data in `core/balance.json` | `builder/` | `builder:highlightPart`, the real `builder/` replacing its stubs |
| **2** | **Flight & Astronaut** | Flight controller (physics + cockpit controls), Flight Assist, launch/orbit scene, entry/landing scene, Max-Q & G meters, first-person walking (ship interior + Mars EVA), interactable system, stations, airlock, suit, oxygen | `flight/`, `surface/` | `FlightController`, `registerInteractable(...)`, `flight:*` / `eva:*` events |
| **3** | **Graphics, Audio & Core** | Renderer + post-processing, skybox, Earth/Mars + atmosphere shaders, cockpit/cabin/Mars visuals, VFX (flame, plasma, dust), HUD theme, cinematic API, all sound, Low/High settings; `core/` (loop, state, events, contract, economy, save), debug panel, `npm run check`; you confirm `dev` boots at every checkpoint | `core/`, `graphics/`, `audio/`, `ui/` | `core/` API + mocks + debug panel, `graphics.init()`, `assets.get(name)`, `getTerrainHeight(x,z)`, `cinematic.play(...)`, `audio.play(id)`, theme CSS |
| **4** | **Story, Cruise & Knowledge** | Cruise scene (map, time-warp, solar storm, malfunction, messages), story + Halcyon-1 logs, Mars tasks & progress, ending screens & sequences (incl. Adrift), black box + Flight Report, Guidebook, all educational/narrative text, demo script | `cruise/`, `story/`, `missions/`, `guidebook/`, `report/` | Text JSONs, task placement data, `guidebook:open`, black-box report |

**Instructions for the AI once the role is set:**
1. Confirm your role in one line.
2. Summarize in 5 bullets what you will build first (Tier 0, §16).
3. List the contracts/stubs you must provide to others by hour 3, and the ones you need from others (use mocks until they arrive).
4. Start coding inside your folders only.

MY ROLE: ___   ← replace ___ with 1, 2, 3 or 4
