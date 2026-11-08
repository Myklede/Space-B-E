# Launch pad section: assets

No asset files are used or downloaded by this section yet.

- The pads of all 31 complexes are procedural three.js geometry written in `art.js`: launch mounts (slab, Starbase-style
  raised table, one-way flame pit with its ring, flame trench, mobile launch platform), towers (tail service masts,
  strongback, Soyuz swing-up gantry, fixed umbilical tower, integration tower with catch arms, mobile service tower,
  rotating service structure), hold-down clamps and arms, the Soyuz support arms, support posts, water ring, water bags,
  rainbirds and water tower, lightning rod, mast and towers, crew arm, escape chute, slidewire baskets, blast-room
  entrance, storage spheres, chilling plant, tanker truck, weather station, radar, field mills and a windsock.
- The ground under each complex is a texture drawn at runtime on a canvas in `art.js` (no image file).
- The card pictures are the same art rendered small by `partIcons.js` (`objectIcon`), nothing baked.
- Planned (wave 4): Blender models under `public/assets/models/builder/pad/`, ids in `art.js` `PAD_MODELS` and
  `NOTES.md`; each will be listed here with its source and licence when it lands.
- NASA 3D Resources models already in `public/assets/nasa/` (`mobile_launcher.glb` = SLS Mobile Launcher 1 assembled,
  `mobile_launcher_pad.glb` = its base, `gantry.glb`, `crawler.glb`; public domain) are not used yet; `mobile_launcher.glb`
  (194 KB, about 19k triangles) may serve LC-39B. Nothing to add to CREDITS.md.
