// Mars surface height in metres. Pure JS with no Three.js, so gameplay can call it every frame.
// The origin is the landing site on the Jezero crater floor. +Y is up, and the ground mesh is built from this function.
// It holds no detail finer than about 20 m, so the mesh and this function agree to within centimetres.

const PERM = new Uint8Array(512);
{
  const p = Array.from({ length: 256 }, (_, i) => i);
  let seed = 1977;
  for (let i = 255; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
}

const GRAD = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];

function perlin(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const X = xi & 255, Y = yi & 255;
  const dot = (ix, iy, dx, dy) => {
    const g = GRAD[PERM[PERM[X + ix] + ((Y + iy) & 255)] & 7];
    return g[0] * dx + g[1] * dy;
  };
  const a = dot(0, 0, fx, fy) + u * (dot(1, 0, fx - 1, fy) - dot(0, 0, fx, fy));
  const b = dot(0, 1, fx, fy - 1) + u * (dot(1, 1, fx - 1, fy - 1) - dot(0, 1, fx, fy - 1));
  return a + v * (b - a); // about -1..1
}

function fbm(x, y, octaves) {
  let a = 1, s = 0, n = 0;
  for (let i = 0; i < octaves; i++) {
    s += a * perlin(x, y);
    n += a;
    x = x * 2.03 + 17.1;
    y = y * 2.03 - 9.3;
    a *= 0.5;
  }
  return s / n;
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// The river delta: a raised plateau with layered scarps, north-east of the landing site.
export const DELTA = { x: 1100, z: -900, radius: 800, height: 46 };
const LANDING_FLAT_RADIUS = 45;

export function getTerrainHeight(x, z) {
  const r = Math.hypot(x, z);

  // Keep the landing pad level, then let the ground roughen with distance.
  const rough = smoothstep(LANDING_FLAT_RADIUS, 170, r);
  let h = fbm(x / 640, z / 640, 3) * 16 * (0.3 + 0.7 * rough);
  h += fbm(x / 95 + 40, z / 95 - 11, 3) * 4.2 * rough;

  // Small dunes and hummocks, about 25 m across.
  h += Math.abs(perlin(x / 42 - 3, z / 42 + 8)) * 1.1 * rough;

  // Delta plateau, cut into terraces like the layered sediment at Jezero.
  const wobble = fbm(x / 210 + 5, z / 210 + 2, 3) * 120;
  const d = Math.hypot(x - DELTA.x, z - DELTA.z) + wobble;
  const rise = smoothstep(DELTA.radius + 110, DELTA.radius - 90, d);
  const bench = fbm(x / 120 - 21, z / 120 + 14, 2) * 0.09; // uneven benches, so no contour looks drawn on
  const steps = Math.max(0, rise + bench * rise * (1 - rise) * 4) * 4;
  const whole = Math.floor(steps);
  const terraced = (whole + smoothstep(0.34, 0.66, steps - whole)) / 4;
  h += (rise * 0.2 + terraced * 0.8) * DELTA.height;

  // The crater rim closes the horizon, kilometres away.
  const rimNoise = fbm(x / 1500 + 80, z / 1500 - 30, 3);
  h += smoothstep(3800, 8200, r + rimNoise * 900) * (430 + rimNoise * 240);

  return h;
}
