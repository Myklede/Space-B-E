import * as THREE from 'three';
import { bakeTexture, getRenderer, GLSL_NOISE, qualitySettings, sharedUniforms } from './shared.js';

const EARTH_COLOR = /* glsl */ `
varying vec2 vUv;
${GLSL_NOISE}
void main() {
  vec3 d = dirFromUv(vUv);
  vec3 w = vec3(fbm(d * 1.7 + 3.1, 5), fbm(d * 1.7 + 7.7, 5), fbm(d * 1.7 + 11.3, 5)) - .5;
  float c = fbm(d * 2.1 + w * 1.5 + vec3(4.2, 1.3, 9.1), 9);
  float sea = .53;
  float land = smoothstep(sea, sea + .003, c);
  float h = clamp((c - sea) / .2, 0., 1.);
  float lat = abs(d.y);
  float m = fbm(d * 5. + w * .9 + 20., 6);
  float arid = smoothstep(.12, .3, lat) * (1. - smoothstep(.38, .56, lat));
  vec3 lc = mix(vec3(.028, .075, .024), vec3(.095, .125, .04), smoothstep(.4, .6, m));
  lc = mix(lc, vec3(.44, .30, .15), smoothstep(.4, .68, arid + (.5 - m) * 1.3));
  lc = mix(lc, vec3(.2, .2, .15), smoothstep(.62, .78, lat + (m - .5) * .2));
  lc = mix(lc, vec3(.2, .16, .12), smoothstep(.45, .85, h));
  lc = mix(lc, vec3(.8, .83, .87), smoothstep(.82, .97, h + lat * .18));
  float ice = smoothstep(.87, .93, lat + (fbm(d * 9., 4) - .5) * .14);
  float depth = clamp((sea - c) / .11, 0., 1.);
  vec3 ocean = mix(vec3(.012, .085, .15), vec3(.003, .016, .055), pow(depth, .55));
  vec3 col = mix(mix(ocean, lc, land), vec3(.85, .88, .92), ice);
  gl_FragColor = vec4(col, max(land * (.06 + .94 * h), ice * .1)); // alpha 0 marks open ocean
}`;

const EARTH_CLOUDS = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uColor;
${GLSL_NOISE}
void main() {
  vec3 d = dirFromUv(vUv);
  vec3 w = vec3(fbm(d * 2. + 1., 4), fbm(d * 2. + 5., 4), fbm(d * 2. + 9., 4)) - .5;
  float streak = fbm(d * vec3(3.2, 7.5, 3.2) + w * 2.6, 9);
  float clouds = smoothstep(.5, .72, streak + cos(d.y * 7.) * .025);
  float land = step(.001, texture2D(uColor, vUv).a);
  float clusters = smoothstep(.52, .7, fbm(d * 13. + 31., 5));
  float dots = pow(fbm(d * 150., 3), 6.) * 26.;
  float lat = abs(d.y);
  float city = land * clusters * dots * (1. - smoothstep(.62, .82, lat));
  gl_FragColor = vec4(clouds, city, 0., 1.);
}`;

const MARS_COLOR = /* glsl */ `
varying vec2 vUv;
${GLSL_NOISE}
float craters(vec3 d, float scale) {
  vec3 p = d * scale, i = floor(p), f = fract(p);
  float h = 0.;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
    vec3 g = vec3(x, y, z);
    if (hash13(i + g + 9.) < .55) continue;
    float r = .12 + .3 * hash13(i + g + 5.);
    float q = length(g + hash33(i + g) - f) / r;
    if (q < 1.7) h += -(1. - smoothstep(0., 1., q)) * .9 + exp(-pow((q - 1.) * 5., 2.)) * .35;
  }
  return h;
}
void main() {
  vec3 d = dirFromUv(vUv);
  vec3 w = vec3(fbm(d * 1.9 + 2.1, 5), fbm(d * 1.9 + 6.3, 5), fbm(d * 1.9 + 9.7, 5)) - .5;
  float large = fbm(d * 2.3 + w * 1.4, 8);
  float crater = craters(d, 13.) * .085 + craters(d, 34.) * .05 + craters(d, 88.) * .022;
  float dark = smoothstep(.44, .6, fbm(d * 2.6 + w * 1.3 + 17., 7));
  float fine = fbm(d * 26., 5);
  vec3 col = mix(vec3(.60, .30, .135), vec3(.72, .42, .22), smoothstep(.4, .62, large));
  col = mix(col, vec3(.15, .10, .08), dark * .78);
  col *= .84 + .32 * fine + crater * .6;
  float cap = smoothstep(.93, .975, abs(d.y) + (fbm(d * 8., 4) - .5) * .05);
  col = mix(col, vec3(.86, .82, .78), cap);
  gl_FragColor = vec4(col, clamp(large * .6 + crater + fine * .08, 0., 1.));
}`;

// Real maps. These compose the same two textures the procedural bake makes, so the surface shader doesn't care which it got.
const EARTH_COMPOSE_COLOR = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uDay;
void main() {
  vec3 c = texture2D(uDay, vUv).rgb;
  float lum = dot(c, vec3(.2126, .7152, .0722));
  // Open water: blue clearly ahead of red, no brighter than green, and dark. Ice and cloud-white fail on the first test.
  bool water = c.b > c.r * 1.5 + .0015 && c.b > c.g * .95 && lum < .3;
  gl_FragColor = vec4(c * (water ? .8 : .9), water ? 0. : .06 + .2 * lum); // alpha 0 marks open ocean
}`;

const EARTH_COMPOSE_CLOUDS = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uClouds;
uniform sampler2D uNight;
uniform sampler2D uMap;
void main() {
  float c = texture2D(uClouds, vUv).r;
  float clouds = smoothstep(.06, .92, c);
  vec3 n = texture2D(uNight, vUv).rgb;
  float lights = smoothstep(.06, .5, dot(n, vec3(.2126, .7152, .0722)));
  lights *= step(.001, texture2D(uMap, vUv).a); // never over open water
  gl_FragColor = vec4(clouds, lights, 0., 1.);
}`;

const MARS_COMPOSE_COLOR = /* glsl */ `
varying vec2 vUv;
uniform sampler2D uMars;
${GLSL_NOISE}
void main() {
  vec3 c = texture2D(uMars, vUv).rgb;
  float lum = dot(c, vec3(.2126, .7152, .0722));
  float fine = fbm(dirFromUv(vUv) * 60., 4) - .5;
  gl_FragColor = vec4(c, clamp(lum * 1.3 + fine * .08, 0., 1.)); // the photo has its own shading baked in, so relief stays gentle
}`;

const SURFACE_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
varying vec3 vQ;
varying vec3 vWorld;
varying vec3 vT;
varying vec3 vB;
void main() {
  vUv = uv;
  float lon = uv.x * 6.2831853, lat = (uv.y - .5) * 3.14159265;
  vT = mat3(modelMatrix) * vec3(sin(lon), 0., cos(lon));
  vB = mat3(modelMatrix) * vec3(cos(lon) * sin(lat), cos(lat), -sin(lon) * sin(lat));
  vQ = mat3(modelMatrix) * position; // world-rotated, free of the huge translation, so derivatives stay precise
  vec4 world = modelMatrix * vec4(position, 1.);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
  #include <logdepthbuf_vertex>
}`;

const SURFACE_FRAGMENT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D uColor;
uniform sampler2D uClouds;
uniform float uIsEarth;
uniform float uBump;
uniform float uTime;
uniform vec3 uSunDir;
uniform float uTexel;
uniform float uClose;
varying vec2 vUv;
${GLSL_NOISE}
varying vec3 vQ;
varying vec3 vWorld;
varying vec3 vT;
varying vec3 vB;
// Slope from neighbouring texels. Screen derivatives of a filtered map come out blocky up close.
vec3 bumped(vec3 N, vec3 T, vec3 B, float scale) {
  float e = max(uTexel, max(fwidth(vUv.x), fwidth(vUv.y)));
  float c = max(cos((vUv.y - .5) * 3.14159265), .06);
  float dT = (texture2D(uColor, vUv + vec2(e, 0.)).a - texture2D(uColor, vUv - vec2(e, 0.)).a) / (2. * e * 6.2831853 * c);
  float dB = (texture2D(uColor, vUv + vec2(0., e)).a - texture2D(uColor, vUv - vec2(0., e)).a) / (2. * e * 3.14159265);
  return normalize(N - scale * (dT * T + dB * B));
}
void main() {
  vec3 N = normalize(vQ);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 L = uSunDir;
  vec3 sun = vec3(1., .97, .92) * 1.75;
  vec4 base = texture2D(uColor, vUv);
  // Near the ground a 4K map is about 1 km a pixel. Noise on the direction adds the missing grain, only when close.
  if (uClose > .001 && (uIsEarth < .5 || base.a > .001)) {
    float g = vnoise(N * 1500.) * .5 + vnoise(N * 5200.) * .3 + vnoise(N * 17000.) * .2;
    base.rgb *= 1. + uClose * (g - .5) * .7;
  }
  vec3 Nb = bumped(N, normalize(vT), normalize(vB), uBump);
  float lit = max(dot(Nb, L), 0.);
  vec3 col = base.rgb * sun * lit;
  if (uIsEarth > .5) {
    vec2 drift = vec2(uTime * .00022, 0.);
    float clouds = texture2D(uClouds, vUv + drift).r;
    float cloudShadow = texture2D(uClouds, vUv + drift + vec2(.0015, -.001)).r;
    col *= 1. - .55 * cloudShadow;
    float ocean = 1. - step(.001, base.a);
    vec3 H = normalize(L + V);
    float glint = (pow(max(dot(N, H), 0.), 1100.) + pow(max(dot(N, H), 0.), 90.) * .012) * ocean * (1. - clouds);
    float fresnel = pow(1. - max(dot(N, V), 0.), 5.);
    col += vec3(1., .88, .72) * glint * 3. * step(0., dot(N, L));
    col += vec3(.16, .3, .5) * fresnel * ocean * .5 * max(dot(N, L), 0.);
    col = mix(col, vec3(.72, .74, .77) * sun * (max(dot(N, L), 0.) * .94 + .008), clouds * .9);
    float night = 1. - smoothstep(-.1, .1, dot(N, L));
    col += vec3(1., .68, .34) * texture2D(uClouds, vUv).g * night * (1. - clouds * .85) * .95;
  }
  gl_FragColor = vec4(col, 1.);
  #include <logdepthbuf_fragment>
}`;

const ATMOSPHERE_VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vObj;
void main() {
  vObj = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  #include <logdepthbuf_vertex>
}`;

// Single scattering through an exponential shell, in units of the planet's radius.
// The same shader gives the halo seen from orbit and the sky seen from inside the air.
const ATMOSPHERE_FRAGMENT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uCamObj;
uniform vec3 uSunDir;
uniform vec3 uBeta;
uniform float uTop;
uniform float uFalloff;
uniform float uSunPower;
varying vec3 vObj;
vec2 hitSphere(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd), c = dot(ro, ro) - r * r, h = b * b - c;
  if (h < 0.) return vec2(1e9, -1e9);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}
void main() {
  vec3 ro = uCamObj, rd = normalize(vObj - ro);
  vec2 shell = hitSphere(ro, rd, uTop);
  float t0 = max(shell.x, 0.), t1 = shell.y;
  vec2 ground = hitSphere(ro, rd, 1.);
  if (ground.x > 0.) t1 = min(t1, ground.x);
  if (t1 <= t0) discard;
  const int STEPS = 10;
  float seg = (t1 - t0) / float(STEPS), viewDepth = 0.;
  float column = (uTop - 1.) / uFalloff;
  vec3 light = vec3(0.);
  for (int i = 0; i < STEPS; i++) {
    vec3 p = ro + rd * (t0 + seg * (float(i) + .5));
    float r = length(p);
    float density = exp(-clamp((r - 1.) / (uTop - 1.), 0., 1.) * uFalloff);
    float mu = dot(p / r, uSunDir);
    float sunDepth = density * column / max(mu + .14, .035);
    viewDepth += density * seg * .5;
    light += density * seg * smoothstep(-.13, .07, mu) * exp(-uBeta * (viewDepth + sunDepth));
    viewDepth += density * seg * .5;
  }
  float c = dot(rd, uSunDir);
  vec3 col = light * uBeta * .75 * (1. + c * c) * uSunPower;
  vec3 through = exp(-uBeta * viewDepth);
  float alpha = 1. - dot(through, vec3(.3333));
  // A bright sky hides the stars behind it. Over the ground, only real extinction may dim the surface.
  if (ground.x <= 0.) alpha = max(alpha, smoothstep(.004, .05, dot(col, vec3(.2126, .7152, .0722))));
  gl_FragColor = vec4(col, alpha);
  #include <logdepthbuf_fragment>
}`;

const SETTINGS = {
  earth: { top: 1.1, falloff: 7.5, beta: [3.3, 7.7, 18.9], sunPower: 1.15, bump: 0.006 },
  mars: { top: 1.2, falloff: 6.1, beta: [0.6, 0.41, 0.19], sunPower: 1.5, bump: 0.008 },
};

const baked = new Map(); // name -> { color, clouds }, shared by every instance
const loading = new Map(); // name -> Promise, so each planet loads once
const live = new Map(); // name -> Set of surface materials waiting on, or showing, those maps

function proceduralMaps(name) {
  const width = qualitySettings().planetTexture;
  const height = width / 2;
  if (name === 'earth') {
    const color = bakeTexture({ width, height, fragment: EARTH_COLOR });
    const clouds = bakeTexture({ width, height, fragment: EARTH_CLOUDS, uniforms: { uColor: { value: color } } });
    return { color, clouds };
  }
  return { color: bakeTexture({ width, height, fragment: MARS_COLOR }), clouds: null };
}

function loadTexture(file, srgb) {
  const url = `${import.meta.env.BASE_URL}assets/textures/${file}_${qualitySettings().planetTexture / 1024}k.jpg`;
  return new THREE.TextureLoader().loadAsync(url).then((t) => {
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearFilter; // read 1:1 by the compose pass, so no mip chain needed
    t.generateMipmaps = false;
    return t;
  });
}

function composeMaps(name, src) {
  const width = qualitySettings().planetTexture;
  const height = width / 2;
  if (name === 'earth') {
    const color = bakeTexture({ width, height, fragment: EARTH_COMPOSE_COLOR, uniforms: { uDay: { value: src.day } } });
    const clouds = bakeTexture({
      width, height, fragment: EARTH_COMPOSE_CLOUDS, type: THREE.UnsignedByteType,
      uniforms: { uClouds: { value: src.clouds }, uNight: { value: src.night }, uMap: { value: color } },
    });
    return { color, clouds };
  }
  return { color: bakeTexture({ width, height, fragment: MARS_COMPOSE_COLOR, uniforms: { uMars: { value: src.mars } } }), clouds: null };
}

/** Resolves once the real maps of a planet are composed and every live instance uses them. Safe to call many times. */
export function loadPlanetMaps(name) {
  if (!SETTINGS[name]) return Promise.resolve();
  if (loading.has(name)) return loading.get(name);
  const files = name === 'earth'
    ? { day: ['earth_day', true], clouds: ['earth_clouds', false], night: ['earth_night', false] }
    : { mars: ['mars', true] };
  const promise = (async () => {
    const sources = {};
    let maps;
    try {
      await Promise.all(Object.entries(files).map(async ([key, [file, srgb]]) => { sources[key] = await loadTexture(file, srgb); }));
      const t0 = performance.now();
      maps = composeMaps(name, sources);
      getRenderer().getContext().finish();
      performance.measure(`planet:${name}:compose`, { start: t0, end: performance.now() });
    } catch (error) {
      console.warn(`[planets] real ${name} maps unavailable (${error?.message ?? 'an image failed to load'}), using generated ones`);
      maps = proceduralMaps(name);
    }
    Object.values(sources).forEach((t) => t.dispose());
    baked.set(name, maps);
    for (const material of live.get(name) ?? []) {
      material.uniforms.uColor.value = maps.color;
      material.uniforms.uClouds.value = maps.clouds ?? maps.color;
    }
  })();
  loading.set(name, promise);
  return promise;
}

// Flat stand-ins shown for the instant before the real maps arrive: deep ocean, or rust. Alpha is above 0 so no glint appears.
const placeholders = new Map();
function placeholderMaps(name) {
  if (!placeholders.has(name)) {
    const make = (r, g, b, a) => {
      const t = new THREE.DataTexture(new Uint8Array([r, g, b, a]), 1, 1);
      t.needsUpdate = true;
      return t;
    };
    placeholders.set(name, { color: make(...(name === 'earth' ? [3, 14, 40, 30] : [140, 70, 35, 120])), clouds: make(0, 0, 0, 255) });
  }
  return placeholders.get(name);
}

/**
 * A planet of radius 1. Scale the group to the radius you need, for example
 * planet.scale.setScalar(PLANETS.earth.radius). Don't rotate the group itself: spin planet.userData.surface.
 */
export function createPlanet(name) {
  const cfg = SETTINGS[name];
  const maps = baked.get(name) ?? placeholderMaps(name);
  loadPlanetMaps(name);
  const group = new THREE.Group();
  group.name = `planet:${name}`;

  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(1, 192, 96),
    new THREE.ShaderMaterial({
      vertexShader: SURFACE_VERTEX,
      fragmentShader: SURFACE_FRAGMENT,
      uniforms: {
        uClose: { value: 0 },
        uColor: { value: maps.color },
        uClouds: { value: maps.clouds ?? maps.color },
        uIsEarth: { value: name === 'earth' ? 1 : 0 },
        uBump: { value: cfg.bump },
        uTexel: { value: 1 / qualitySettings().planetTexture },
        uTime: sharedUniforms.uTime,
        uSunDir: sharedUniforms.uSunDir,
      },
    }),
  );
  group.add(surface);
  if (!live.has(name)) live.set(name, new Set());
  live.get(name).add(surface.material);

  const shellMaterial = new THREE.ShaderMaterial({
    vertexShader: ATMOSPHERE_VERTEX,
    fragmentShader: ATMOSPHERE_FRAGMENT,
    uniforms: {
      uCamObj: { value: new THREE.Vector3() },
      uSunDir: sharedUniforms.uSunDir,
      uBeta: { value: new THREE.Vector3(...cfg.beta) },
      uTop: { value: cfg.top },
      uFalloff: { value: cfg.falloff },
      uSunPower: { value: cfg.sunPower },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquation: THREE.AddEquation,
  });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(cfg.top, 128, 64), shellMaterial);
  shell.renderOrder = 1;
  group.add(shell);

  const cam = new THREE.Vector3();
  group.userData.surface = surface;
  group.userData.onFrame = (_dt, camera) => {
    camera.getWorldPosition(cam);
    group.worldToLocal(cam);
    shellMaterial.uniforms.uCamObj.value.copy(cam);
    surface.material.uniforms.uClose.value = 1 - THREE.MathUtils.smoothstep(cam.length() - 1, 0.04, 0.2);
    shellMaterial.side = cam.length() < cfg.top ? THREE.BackSide : THREE.FrontSide;
  };
  return group;
}
