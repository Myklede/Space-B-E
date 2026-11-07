// The vehicle's outer skin (Role 1 agent "hull" owns this file). Pure: no browser or core imports.
//
// Real rockets are one smooth body from the outside: interstages, skirts, intertanks, fairings and conical adapters
// cover every narrower part, so the air sees one cylinder and the loads run through one shell. This module works out
// that shell from the layout and prices it. The player picks one skin material per section (nose, body, tail).
//
// PHASE 0 STUB: no skin yet, every number neutral. The hull agent replaces the body of these functions and keeps the
// exports and the shape of what they return (stats.js, designPage.js, designScene.js and asBuilt.js read them).

/** Sections that get a skin. */
export const HULL_SECTIONS = ['nose', 'body', 'tail'];

/**
 * The skin materials a section may use; the first one is the default.
 * Each: { id, name, short, note, pros: [], cons: [], real, massPerM2 (kg), costPerM2 ($), maxTempC, strengthKPa, cdAFactor }.
 */
export function hullChoices(sectionId) {
  void sectionId;
  return [{ id: 'al2219', name: 'Aluminium 2219 skin', short: 'Aluminium', note: 'Placeholder until the hull agent fills in the real materials.', pros: [], cons: [], real: '', massPerM2: 0, costPerM2: 0, maxTempC: 150, strengthKPa: 60, cdAFactor: 1 }];
}

/** The material a section uses now (assembly.hull[sectionId], or the default). */
export function hullMaterial(hull, sectionId) {
  const list = hullChoices(sectionId);
  return list.find((m) => m.id === hull?.[sectionId]) ?? list[0];
}

/**
 * computeHull(layout, { catalog, hull }) → the skin around the stack.
 *   segments: [{ section, kind: 'skirt' | 'cone' | 'fairing', y0, y1, r0, r1, material, mass, cost, sideArea, centerY }]
 *   mass, cost, sideArea: totals added to the ship by stats.js
 *   cdAFactor: multiplies the ascent drag area (a smooth body has less drag than a lumpy one)
 *   bySection: { nose: { material, mass, cost, area }, body: …, tail: … }
 *   insideIds: ids of radial parts that ride inside the skin (equipment), drawn only when their section is open
 *   risk: { maxQ: 0..1, heat: 0..1, notes: [] } chances asBuilt.js may roll for a skin failure, with the reasons
 *   limits: { maxQKPa, maxTempC } of the weakest skin, for the investigation board and a later Role 2 hook
 */
export function computeHull(layout, { catalog = null, hull = {} } = {}) {
  void layout; void catalog; void hull;
  return { segments: [], mass: 0, cost: 0, sideArea: 0, cdAFactor: 1, bySection: {}, insideIds: [], risk: { maxQ: 0, heat: 0, notes: [] }, limits: { maxQKPa: Infinity, maxTempC: Infinity } };
}
