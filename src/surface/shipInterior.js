// Walkable ship cabin (Role 2). TEAM_PROMPT §7.1.
// Registers the cabin stations on the shared interactable system and runs the suit/airlock logic.
// The 3D cabin is Role 3's `assets.get('cabin')`: pass its `userData.stations` / `userData.props`
// so the interaction points sit exactly on the art. CABIN below mirrors that layout as a fallback.
//
// Cabin (Role 3 interiors.js): 4 m wide (x −2..2) × 8 m long (z −4..4), origin = middle of the floor,
// pilot seat at −Z, airlock at +Z, height 2.6 m (walls 2.15 m, then a chamfer).
//
// const cabinArt = assets.get('cabin');
// const cabin = createShipInterior({ bus, interactables, oxygen, stations: cabinArt.userData.stations, props: cabinArt.userData.props });
// Emits: interior:interact { stationId }            — every station use (Role 4 listens for 'comms', 'storage', 'prop:*')
//        interior:suit { suited }                    — suit HUD on/off (Role 3)
//        interior:airlock { stage, progress }        — 'cycling' (lights/sound) | 'open'
//        state:request { to, reason }                — PROPOSED contract: ask core to switch state

// Role 3 station names → our station ids (ids are what events carry)
export const ROLE3_STATION_NAMES = {
  seat: 'pilotSeat',
  suit: 'suitLocker',
  o2: 'o2Station',
  comms: 'commsConsole',
  storage: 'sampleStorage',
  airlock: 'airlock',
};

export const CABIN = {
  bounds: { minX: -2, maxX: 2, minZ: -4, maxZ: 4, ceiling: 2.5 },
  spawn: { x: 0, z: -2.4 }, // standing behind the pilot seat, facing the airlock (+Z)
  spawnYaw: Math.PI, // yaw π = looking toward +Z
  stations: {
    seat: { x: 0, y: 1.2, z: -3.3 },
    suit: { x: -1.7, y: 1.2, z: 0.7 },
    o2: { x: -1.72, y: 1.2, z: -1.1 },
    comms: { x: 1.7, y: 1.2, z: -1.3 },
    storage: { x: 1.72, y: 1.2, z: 0.9 },
    airlock: { x: 0, y: 1.2, z: 3.86 },
  },
  // crew-life props: Role 4 shows a real fact for each ('prop:<id>')
  props: {
    bunk: { x: -1.55, y: 1.0, z: -2.75 },
    familyPhoto: { x: -1.2, y: 1.2, z: -2.9 },
  },
};

const xyz = (v) => ({ x: v.x, y: v.y, z: v.z });

// Accepts Role 3's userData.stations ({ pilotSeat: Vector3, ... }) or our own { seat: {x,y,z}, ... }.
export function resolveStations(stations) {
  if (!stations) return CABIN.stations;
  const out = {};
  for (const [id, role3Name] of Object.entries(ROLE3_STATION_NAMES)) {
    const p = stations[role3Name] ?? stations[id] ?? CABIN.stations[id];
    out[id] = xyz(p);
  }
  return out;
}

export const AIRLOCK_CYCLE_SECONDS = 3;

export function createShipInterior({ bus, interactables, oxygen, canExit = () => true, stations, props } = {}) {
  bus = bus ?? { emit() {} };
  const st = { suited: false, airlock: null, offs: [] }; // airlock: null | { t }
  const S = resolveStations(stations);
  const P = props ? Object.fromEntries(Object.entries(props).map(([k, v]) => [k, xyz(v)])) : CABIN.props;
  const reg = (def) => st.offs.push(interactables.register(def));
  const ping = (stationId) => bus.emit('interior:interact', { stationId });

  reg({
    id: 'seat', position: S.seat, prompt: () => (st.suited ? 'Take off the suit before flying' : 'E: sit down (pilot seat)'),
    onUse: () => {
      ping('seat');
      if (!st.suited) bus.emit('state:request', { to: 'LANDING', reason: 'seat' });
    },
  });
  reg({
    id: 'suit', position: S.suit, prompt: () => (st.suited ? 'E: take off suit' : 'E: put on spacesuit'),
    onUse: () => {
      st.suited = !st.suited;
      ping('suit');
      bus.emit('interior:suit', { suited: st.suited });
    },
  });
  reg({
    id: 'o2', position: S.o2,
    prompt: () => (oxygen ? `E: swap O₂ tank (${oxygen.spareTanks} spare)` : 'O₂ station'),
    enabled: () => !!oxygen,
    onUse: () => {
      ping('o2');
      if (oxygen && !oxygen.swapTank()) bus.emit('interior:interact', { stationId: 'o2:empty' });
    },
  });
  reg({ id: 'comms', position: S.comms, prompt: 'E: comms console (HQ, family, upload data)', onUse: () => ping('comms') });
  reg({ id: 'storage', position: S.storage, prompt: 'E: sample storage', onUse: () => ping('storage') });
  reg({
    id: 'airlock', position: S.airlock,
    prompt: () => (!st.suited ? 'Suit up before using the airlock' : st.airlock ? 'Cycling…' : 'E: cycle airlock → Mars'),
    onUse: () => {
      ping('airlock');
      if (!st.suited || st.airlock || !canExit()) return;
      st.airlock = { t: 0 };
    },
  });
  // the bunk is a station in Role 3's art; treat it as a crew-life prop here
  const bunk = stations?.bunk ? { bunk: xyz(stations.bunk) } : {};
  for (const [id, position] of Object.entries({ ...bunk, ...P })) {
    reg({ id: `prop:${id}`, position, radius: 1.4, prompt: 'E: look', onUse: () => ping(`prop:${id}`) });
  }

  return {
    stations: S,
    get suited() { return st.suited; },
    set suited(v) { st.suited = !!v; bus.emit('interior:suit', { suited: st.suited }); },
    get airlockProgress() { return st.airlock ? Math.min(1, st.airlock.t / AIRLOCK_CYCLE_SECONDS) : 0; },
    update(dt) {
      if (!st.airlock) return;
      st.airlock.t += dt;
      const progress = Math.min(1, st.airlock.t / AIRLOCK_CYCLE_SECONDS);
      bus.emit('interior:airlock', { stage: progress < 1 ? 'cycling' : 'open', progress });
      if (progress >= 1) {
        st.airlock = null;
        bus.emit('state:request', { to: 'SURFACE', reason: 'airlock' });
      }
    },
    dispose() { st.offs.forEach((off) => off()); st.offs = []; },
  };
}
