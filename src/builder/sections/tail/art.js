// 3D art for the tail section's own parts. Owned by whoever builds the tail section.
// The shared code (bay/partArt.js, bay/internalsArt.js) asks here first and falls back to the procedural hardware in
// bay/partMeshes.js and the real NASA models (each part's `model` field) when these return null.
// Units: metres; a part stands on y = 0, centred on the stack axis (axial) or with its root at x = 0 pointing +x (radial).

/** Art for one placed part: entry = { type, def, attach, height, radius }. Return an Object3D, or null for the default. */
export function partArt(entry) {
  void entry;
  return null;
}

/**
 * The pieces inside a part, for the exploded view: [{ key (the kit slot), name, object, dir (THREE.Vector3) }], or null
 * for the default pieces in bay/internalsArt.js. options = { slotKey: chosenOption }, dims = { radius, height }.
 */
export function internalsArt(def, options, dims) {
  void def; void options; void dims;
  return null;
}
