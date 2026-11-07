import { graphics } from "../src/graphics/index.js";
import "../src/ui/theme.css";
import { createDebrisField } from "../src/flight/debris.js";
import { atmosphereTop } from "../src/flight/atmosphere.js";
import { createIntegratedFlightScene, preloadFlightArt } from "../src/flight/scenes/role3Bridge.js";
import { MOCK_PLANETS, MOCK_SHIPS, STARTS } from "../src/flight/presets.js";
graphics.init({ quality: new URLSearchParams(location.search).get('q') ?? 'high' });
await preloadFlightArt();
const bus = { emit(name, payload) {
  if (name === "flight:failed") console.info(name, payload);
} };
const orbitAltitude = 150000;
const earth = MOCK_PLANETS.earth;
const starts = {
  launch: {},
  orbit: {
    start: {
      altitude: orbitAltitude,
      speed: Math.sqrt(earth.g * earth.radius ** 2 / (earth.radius + orbitAltitude)),
      flightPathDeg: 0,
    },
  },
  entry: { planetId: "mars", shipSpec: MOCK_SHIPS.marsArrival, start: STARTS.marsEntry },
  landing: { planetId: "mars", shipSpec: MOCK_SHIPS.marsArrival, start: STARTS.marsLanding },
};
let current, last = performance.now();
function select(name) {
  current?.dispose();
  current = createIntegratedFlightScene({
    bus,
    planets: MOCK_PLANETS,
    shipSpec: MOCK_SHIPS.reliable,
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    ...starts[name],
  });
  window.flightScene = current;
  history.replaceState(null, "", `?mode=${name}&debug=1`);
  document.querySelectorAll("nav button").forEach((b) => b.setAttribute("aria-pressed", String(b.textContent === name)));
}
for (const name of Object.keys(starts)) {
  const button = document.createElement("button");
  button.textContent = name;
  button.onclick = () => select(name);
  document.querySelector("nav").append(button);
}
function spawnDebris() {
  const fc = current.controller;
  if (fc.planetId !== 'earth' || fc.altitude < atmosphereTop(fc.planet)) return;
  fc.setObstacles(createDebrisField({ fc, seed: 7 }));
}
const debrisButton = document.createElement('button');
debrisButton.textContent = 'Debris (B)';
debrisButton.title = 'Earth orbit only. Relative encounter speed is slowed for gameplay.';
debrisButton.onclick = spawnDebris;
document.querySelector('nav').append(debrisButton);
addEventListener('keydown', event => {
  if (event.code === 'KeyB' && !event.repeat) spawnDebris();
});
const mode = new URLSearchParams(location.search).get("mode");
select(mode in starts ? mode : "launch");
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1e3);
  last = now;
  try {
    current.update(dt);
  } catch (error) {
    document.getElementById("error").textContent = error.message;
    throw error;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
addEventListener("pagehide", () => {
  current?.dispose();
}, { once: true });
