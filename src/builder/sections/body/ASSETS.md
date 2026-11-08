# Body section: assets

No new files are shipped yet. The body art is still procedural: three.js geometry and canvas textures drawn in `art.js` (brushed stainless, carbon twill, sprayed foam, gold MLI, isogrid and orthogrid patterns, stencil labels).

## Planned Blender models (wave 4)

There are 20 planned models, listed in `NOTES.md` ("For the body modeller"). They will go to `public/assets/models/builder/body/<slug>.glb`. All will be built from our own Blender scripts in `src/builder/tools/blender/body/`, so there is no third-party licence. A part gets `"model": { "builder": "body/<slug>" }` only once its file exists.

## Existing NASA models still used by body parts (unchanged, already credited)

- `satkit_wings1`: solar panel.
- `oru`: battery, fuel cell.
- `cos_spectrograph`: spectrometer.
- `satkit_radio2`: ground radar.
- `satkit_body1`: drill.
- `wfpc`: science camera.
- `satkit_body2`: sample containers.

Source: NASA 3D Resources, https://github.com/nasa/NASA-3D-Resources (public domain).

The NASA vehicle models on disk (`external_tank`, `saturn_v`, `atlas`, `ares1`) are not cut up; they are only a proportion check. The NASA SLS Block 1 model in the same repository is a proportion check for `sls_core`.

## Reference images (measuring only, not shipped)

The wave 4 research kept its reference images outside the repo, in `spaceb-wave4/body/refs/`.

- **Public domain.** Most are from the NASA image library: the Saturn V S-IC, S-II and S-IVB cutaways (0100981, 9801810, 0100983), Instrument Unit 0100984, Saturn IB 0100801, 6522687 and 6973447, External Tank 9801795, and Gemini 2 S65-14150. Others are Commons files tagged PD-NASA: the SLS core stage configuration and side view, the ICPS, Delta IV, the Atlas V CCB, Super Heavy, the Energia-Polyus drawing, the 1967 N1 mockup (NRO) and Soyuz on the pad.
- **Reference only:** the FAA Starship cutaway, and all ESA/Arianespace, JAXA/MHI, ISRO, CNSA, Roscosmos and RussianSpaceWeb material. The same goes for every CC BY-SA photo, such as Proton and Long March 5 on Commons, and the Commons STL models `N1.stl` and `Voskhod_Rocket.stl` (CC BY-SA 4.0). These are for looking and measuring: never ship them or trace them into textures.
