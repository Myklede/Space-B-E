// 3D art for one catalogue part. Order of preference: real NASA hardware (bay/nasa.js) → detailed procedural
// hardware (bay/partMeshes.js) → Role 3's rocketPart meshes (legs, and anything else not covered).
import * as THREE from 'three';
import { assets } from '/src/graphics/index.js';
import { nasaPartArt } from './nasa.js';
import {
  airbagMesh, avionicsRingMesh, chuteMesh, finMesh, heatShieldMesh, hiadMesh, instrumentMesh, kickMotorMesh, moduleMesh, noseMesh,
  pafMesh, ringMesh, rtgMesh, sectionMesh, solarWingMesh, sphereMesh, spinTableMesh, srbMesh, tankMesh, trussMesh, wiringTunnelMesh,
} from './partMeshes.js';

const FAMILY_TINT = {
  control: 0x4b5563, thermal: 0x6b4a3a, recovery: 0xb45309, life: 0x1e5a6e, power: 0x1f4d8a, comms: 0x475569, protection: 0x3f3f46, science: 0x3b5a3a, seals: 0x5b2333, structure: 0x4b5563,
};

/** Procedural art for a part (no real model). Null when only Role 3's generic mesh applies. */
function proceduralArt(entry) {
  const def = entry.def;
  if (!def) return null;
  const type = entry.type.toLowerCase();
  const radius = entry.radius ?? 1.25;
  if (entry.attach === 'axial') {
    if (def.fuel) return tankMesh(def, radius);
    if (/nose|fairing/.test(type)) return noseMesh(def, radius);
    if (/hiad/.test(type)) return hiadMesh(def, radius);
    if (def.flags?.heatShield) return heatShieldMesh(def, radius);
    if (/interstage|centerbody/.test(type)) return sectionMesh(def, radius);
    if (/truss/.test(type)) return trussMesh(def, radius);
    if (/avionics/.test(type)) return avionicsRingMesh(def, radius);
    if (/paf/.test(type)) return pafMesh(def, radius);
    if (/spin_table/.test(type)) return spinTableMesh(def, radius);
    if (def.booster) return kickMotorMesh(def, radius);
    return null;
  }
  if (/fin/.test(type)) return finMesh(def);
  if (def.booster) return srbMesh(def);
  if (/helium|nitrogen/.test(type)) return sphereMesh(def, /nitrogen/.test(type) ? 0xb9c6d2 : 0xd8dde2);
  if (/wiring/.test(type)) return wiringTunnelMesh(def);
  if (/solar_wing/.test(type)) return solarWingMesh(def);
  if (/rtg/.test(type)) return rtgMesh(def);
  if (def.flags?.parachute) return chuteMesh(def, /drogue/.test(type) ? 0xd9d7d1 : 0xe08a3a);
  if (/airbag/.test(type)) return airbagMesh(def);
  if (/camera/.test(type)) return instrumentMesh(def, 'camera');
  if (/star_tracker/.test(type)) return instrumentMesh(def, 'tracker');
  if (/weather/.test(type)) return instrumentMesh(def, 'weather');
  if (/seismo/.test(type)) return instrumentMesh(def, 'seismo');
  if (/leg/.test(type)) return null;
  return moduleMesh(def, FAMILY_TINT[def.family] ?? 0x3b4148);
}

/** Returns an Object3D for a layout entry { type, attach, height, radius, def }. */
export function partArt(entry) {
  const def = entry.def;
  const radius = entry.radius ?? 1.25;
  if (def?.flags?.cheapSeals) return ringMesh(def, radius, 0x8a6d3b);
  if (def?.flags?.gimbal) return ringMesh(def, radius, 0x6b7280);
  const real = nasaPartArt(entry.type);
  if (real) {
    real.userData.width = entry.attach === 'radial' ? Math.min(1.2, def?.height ?? 0.8) : undefined;
    if (def?.booster && entry.attach === 'radial') real.userData.srb = true;
    return real;
  }
  const made = proceduralArt(entry);
  if (made) return made;
  return assets.get(`rocketPart:${entry.type}`); // Role 3's art (legs, capsules and engines until the real model loads)
}

export const moduleBox = (entry) => moduleMesh(entry.def ?? { height: entry.height, name: entry.type, family: 'control', id: entry.type });
export { THREE };
