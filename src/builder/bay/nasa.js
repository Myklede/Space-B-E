// Real spacecraft hardware for the catalogue parts: public-domain models from github.com/nasa/NASA-3D-Resources
// (public/assets/nasa/*.glb), cut out by node name where a file holds a whole vehicle, then normalised so every
// part stands on y = 0, centred on the stack axis, scaled to its catalogue height. Credit: NASA.
// Files load on demand (requestPartArt): nothing downloads until a part is on the stand or on the design page.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const BASE = '/assets/nasa/';
const draco = new DRACOLoader();
draco.setDecoderPath('/assets/draco/'); // the decoder copied from three/examples/jsm/libs/draco/gltf (Apache-2.0)
const loader = new GLTFLoader();
loader.setDRACOLoader(draco);

/**
 * Which model each part uses (filled from the parts' `model` field by registerNasaModels). `nodes` selects children by name (whole file when absent); `up` says which model axis
 * becomes the vertical: 'x' | 'y' | 'z' | 'long' (longest side) | 'short' (shortest side); `thin` optionally turns the
 * thinnest side towards +x (outward, for panels and dishes); `flip` turns the part upside down; `tint` recolours
 * untextured models; `fit` scales by 'height' (default) or 'width'.
 */
export const NASA_PARTS = {};

/** Reads each part's `model` field (sections/<id>/parts.json) into NASA_PARTS. Call once with the catalogue. */
export function registerNasaModels(catalog) {
  for (const def of catalog.parts) if (def.model?.model) NASA_PARTS[def.id] = def.model;
  return Object.keys(NASA_PARTS).length;
}

const files = new Map(); // model slug -> Promise<scene|null>
const protos = new Map(); // part id -> normalised Object3D (prototype)
const pending = new Map(); // part id -> Promise

const failures = new Map(); // slug -> message
function loadFile(slug) {
  if (!files.has(slug)) {
    files.set(slug, new Promise((resolve) => loader.load(`${BASE}${slug}.glb`, (g) => resolve(g.scene), undefined, (error) => {
      failures.set(slug, String(error?.message ?? error));
      resolve(null);
    })));
  }
  return files.get(slug);
}
export const nasaFailures = () => Object.fromEntries(failures);

function bakedClone(node) {
  const c = node.clone(true);
  c.position.set(0, 0, 0);
  c.quaternion.identity();
  c.scale.set(1, 1, 1);
  c.updateMatrix();
  c.applyMatrix4(node.matrixWorld);
  return c;
}

const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

function normalise(source, cfg, height) {
  source.updateMatrixWorld(true);
  const group = new THREE.Group();
  if (cfg.nodes) {
    for (const name of cfg.nodes) {
      const node = source.getObjectByName(name);
      if (node) group.add(bakedClone(node));
    }
  } else {
    for (const child of source.children) group.add(bakedClone(child));
  }
  if (!group.children.length) return null;
  // pick the vertical axis
  let box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const dims = ['x', 'y', 'z'];
  let upAxis = cfg.up ?? 'y';
  if (upAxis === 'long') upAxis = dims[[size.x, size.y, size.z].indexOf(Math.max(size.x, size.y, size.z))];
  if (upAxis === 'short') upAxis = dims[[size.x, size.y, size.z].indexOf(Math.min(size.x, size.y, size.z))];
  const holder = new THREE.Group();
  holder.add(group);
  if (upAxis !== 'y') group.quaternion.setFromUnitVectors(AXES[upAxis], AXES.y);
  if (cfg.thin) {
    // after the vertical is set, turn the thinnest horizontal side towards +x
    holder.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(holder);
    const s = box.getSize(new THREE.Vector3());
    if (s.z < s.x) holder.rotation.y = Math.PI / 2;
  }
  if (cfg.flip) holder.rotateX(Math.PI);
  holder.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(holder);
  const s = box.getSize(new THREE.Vector3());
  const scale = cfg.fit === 'width' ? height / Math.max(s.x, s.z) : height / Math.max(s.y, 1e-6);
  const centre = box.getCenter(new THREE.Vector3());
  const out = new THREE.Group();
  holder.position.set(-centre.x * scale, -box.min.y * scale, -centre.z * scale);
  holder.scale.setScalar(scale);
  out.add(holder);
  out.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    o.material = mats.map((m) => {
      const std = m.isMeshStandardMaterial ? m.clone() : new THREE.MeshStandardMaterial({ color: m.color ?? 0xdddddd, map: m.map ?? null });
      if (cfg.tint && (!std.map || cfg.forceTint)) std.color.set(cfg.tint);
      if (cfg.roughness != null) std.roughness = cfg.roughness;
      if (cfg.metalness != null) std.metalness = cfg.metalness;
      else if (!std.map) { std.metalness = Math.min(std.metalness, 0.4); std.roughness = Math.max(std.roughness, 0.35); }
      std.side = THREE.FrontSide;
      return std;
    });
    if (o.material.length === 1) o.material = o.material[0];
  });
  out.userData.nasa = cfg.model;
  return out;
}

/**
 * Loads the model one part needs and builds its prototype. Resolves to true when real art is ready for it
 * (false for parts without a model or when the file is missing). Never throws.
 */
export function requestPartArt(partId, catalog) {
  const cfg = NASA_PARTS[partId];
  const def = catalog.get(partId);
  if (!cfg || !def) return Promise.resolve(false);
  if (protos.has(partId)) return Promise.resolve(true);
  if (!pending.has(partId)) {
    pending.set(partId, loadFile(cfg.model).then((scene) => {
      if (!scene) return false;
      try {
        const proto = normalise(scene, cfg, def.height);
        if (proto) protos.set(partId, proto);
        return !!proto;
      } catch (error) {
        console.warn(`[nasa] could not prepare ${partId} from ${cfg.model}:`, error);
        return false;
      }
    }));
  }
  return pending.get(partId);
}

/** Loads the models for a list of part ids. Resolves to the number that now have real art. */
export async function preloadNasaParts(catalog, ids = Object.keys(NASA_PARTS)) {
  const results = await Promise.all([...new Set(ids)].map((id) => requestPartArt(id, catalog)));
  if (failures.size) console.warn('[nasa] models that did not load:', Object.fromEntries(failures));
  return results.filter(Boolean).length;
}

export const hasNasaArt = (partId) => protos.has(partId);
export const wantsNasaArt = (partId) => !!NASA_PARTS[partId] && !protos.has(partId);

/** A fresh copy of the real model for this part, or null when there is none (yet). */
export function nasaPartArt(partId) {
  const proto = protos.get(partId);
  if (!proto) return null;
  const copy = proto.clone(true);
  copy.traverse((o) => { if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone(); });
  return copy;
}

/**
 * A real NASA model as hall equipment: loaded and normalised like a part (standing on y = 0, centred, `height`
 * metres tall, or `fit: 'width'` metres wide). Resolves to null when the file is missing, never throws.
 */
export async function nasaProp(slug, cfg = {}, height = 1) {
  const scene = await loadFile(slug);
  if (!scene) return null;
  try {
    return normalise(scene, { ...cfg, model: slug }, height);
  } catch (error) {
    console.warn(`[nasa] could not prepare prop ${slug}:`, error);
    return null;
  }
}
