# Body section: assets

No new files downloaded. All new body art is procedural three.js geometry and canvas textures drawn in `art.js` (brushed stainless, carbon twill, sprayed foam, gold MLI, isogrid and orthogrid patterns, stencil labels).

Existing NASA models still used by body parts, unchanged (already credited): `satkit_wings1` (solar panel), `oru` (battery, fuel cell), `cos_spectrograph` (spectrometer), `satkit_radio2` (ground radar), `satkit_body1` (drill), `wfpc` (science camera), `satkit_body2` (sample containers). Source: NASA 3D Resources, https://github.com/nasa/NASA-3D-Resources (public domain).

The NASA vehicle models on disk (`external_tank`, `saturn_v`, `atlas`, `ares1`) were not cut up: their tank pieces do not stack cleanly at the game's three diameters, so the tanks are drawn procedurally to fill exactly y = 0 to height at the part's radius.
