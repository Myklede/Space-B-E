const fmt = (value, digits = 0) => Number.isFinite(value) ? value.toFixed(digits) : '—';

export function createSuitHUD({ parent = document.body, reducedMotion = false } = {}) {
  const root = document.createElement('div');
  root.className = 'suit-presentation';
  root.innerHTML = `<style>
.suit-presentation { position:absolute; inset:0; pointer-events:none; color:#d6eeee; font:12px/1.5 ui-monospace,monospace; --signal:#81e7df; }
.suit-presentation * { box-sizing:border-box; }
.suit-presentation[data-level=caution] { --signal:#ffc281; }
.suit-presentation[data-level=warning], .suit-presentation[data-level=critical] { --signal:#ff7f87; }
.suit-presentation .helmet { position:absolute; inset:0; border:18px solid #071318; border-radius:22%; box-shadow:inset 0 0 0 1px #90c7cb55,inset 0 0 65px #0008; }
.suit-presentation .helmet::after { content:''; position:absolute; inset:10% 4%; border-left:1px solid #a6e7ed22; border-right:1px solid #a6e7ed22; border-radius:35%; }
.suit-presentation .shade { position:absolute; inset:0; background:radial-gradient(ellipse,transparent 20%,#150308 100%); opacity:0; }
.suit-presentation .header { position:absolute; top:38px; left:48px; right:48px; display:flex; justify-content:space-between; letter-spacing:.16em; }
.suit-presentation small { color:#a1babe; font-size:10px; letter-spacing:.13em; }
.suit-presentation .life { position:absolute; bottom:95px; left:48px; width:245px; padding:15px; background:#07171bce; border-left:2px solid var(--signal); }
.suit-presentation .oxygen { color:var(--signal); font-size:32px; display:block; }
.suit-presentation meter { display:block; width:100%; height:7px; accent-color:var(--signal); }
.suit-presentation .row { display:flex; justify-content:space-between; margin-top:9px; }
.suit-presentation .navigation { position:absolute; right:48px; bottom:115px; text-align:right; padding:15px; background:#07171baa; }
.suit-presentation .beacon { font-size:24px; color:#81e7df; display:inline-block; }
.suit-presentation .crosshair { position:absolute; left:50%; top:50%; width:5px; height:5px; border:1px solid #d6eeeeaa; border-radius:50%; transform:translate(-50%,-50%); }
.suit-presentation .prompt { position:absolute; left:25%; right:25%; top:60%; text-align:center; }
.suit-presentation progress { display:block; width:150px; height:5px; margin:10px auto; accent-color:#81e7df; }
.suit-presentation .warning { position:absolute; left:20%; right:20%; top:20%; text-align:center; color:var(--signal); letter-spacing:.1em; }
.suit-presentation .help { position:absolute; left:48px; right:48px; bottom:40px; border-top:1px solid #a2d4d933; padding-top:12px; color:#a1babe; }
.suit-presentation [hidden] { display:none!important; }
@media(max-width:650px) { .suit-presentation .life { left:25px; width:190px; bottom:100px; } .suit-presentation .navigation { right:25px; bottom:100px; font-size:10px; } .suit-presentation .header { left:25px; right:25px; font-size:10px; } .suit-presentation .help { left:25px; right:25px; font-size:9px; } }
</style>
<div class="helmet"></div><div class="shade"></div>
<div class="header"><span data-id="location"></span><span data-id="suit"></span></div>
<div class="crosshair"></div><div class="warning" role="status"></div>
<div class="prompt"><span data-id="prompt"></span><progress max="1" value="0" hidden></progress></div>
<div class="life"><small>PERSONAL LIFE SUPPORT</small><strong class="oxygen" data-id="oxygen"></strong><meter min="0" max="100" value="100" aria-label="Suit oxygen"></meter>
<div class="row"><span>SUPPLY / SPARES</span><span data-id="supply"></span></div>
<div class="row"><span>HEART RATE</span><span data-id="heart"></span></div>
<div class="row"><span>LOCAL GRAVITY</span><span data-id="gravity"></span></div>
<div class="row body"><span>DOSE / PEAK G</span><span data-id="body"></span></div></div>
<div class="navigation"><small>SHIP RADIO BEACON</small><div><span class="beacon">↑</span> <span data-id="distance"></span></div><div data-id="motion"></div></div>
<div class="help">CLICK mouse look · WASD walk · SHIFT run · SPACE jump · E interact / hold to scan</div>`;
  parent.append(root);
  const fields = Object.fromEntries([...root.querySelectorAll('[data-id]')].map(el => [el.dataset.id, el]));
  const helmet = root.querySelector('.helmet');
  const shade = root.querySelector('.shade');
  const warning = root.querySelector('.warning');
  const navigation = root.querySelector('.navigation');
  const arrow = root.querySelector('.beacon');
  const progress = root.querySelector('progress');
  const meter = root.querySelector('meter');
  let elapsed = 0;
  let previousMessage = '';

  return {
    root,
    update(dt, { telemetry: t, oxygen, suited, inside, focused, yaw, shipPosition, bodyStats, airlockProgress = 0 }) {
      elapsed += dt;
      const level = inside ? 'ok' : oxygen.level;
      root.dataset.level = level;
      helmet.hidden = !suited;
      fields.location.textContent = inside ? 'CABIN / PRESSURISED' : 'MARS / SURFACE EVA';
      fields.suit.textContent = suited ? 'SUIT CONNECTED' : 'SUIT STOWED';
      fields.oxygen.textContent = `${fmt(oxygen.percent)}% O₂`;
      fields.supply.textContent = `${fmt(oxygen.secondsLeft)} s / ${oxygen.spareTanks}`;
      fields.heart.textContent = `${t.heartRate} bpm`;
      fields.gravity.textContent = `${fmt(t.gravity, 2)} m/s²`;
      root.querySelector('.body').hidden = !bodyStats;
      if (bodyStats) fields.body.textContent = `${fmt(bodyStats.doseMSv, 3)} mSv / ${fmt(bodyStats.peakG, 1)} g`;
      meter.value = oxygen.percent;
      fields.prompt.textContent = focused?.prompt ?? '';
      progress.hidden = focused?.holdProgress == null;
      progress.value = focused?.holdProgress ?? 0;
      navigation.hidden = inside;
      if (!inside) {
        const dx = shipPosition.x - t.pos.x;
        const dz = shipPosition.z - t.pos.z;
        const distance = Math.hypot(dx, dz);
        // CSS zero points up; positive rotation points to the player's right.
        const relativeBearing = Math.atan2(dx, -dz) + yaw;
        arrow.style.transform = `rotate(${relativeBearing}rad)`;
        arrow.hidden = distance < 1;
        fields.distance.textContent = distance < 1 ? 'AT HATCH' : `${fmt(distance)} m`;
        fields.motion.textContent = `${fmt(t.speed, 1)} m/s · ${t.running ? 'RUN / O₂ USE ↑' : t.onGround ? 'GROUNDED' : 'AIRBORNE'}`;
      }
      let message = '';
      if (oxygen.depleted) message = 'OXYGEN DEPLETED — MISSION ENDED';
      else if (inside && airlockProgress > 0) message = `AIRLOCK CYCLING ${fmt(airlockProgress * 100)}%`;
      else if (inside) message = 'CABIN SUPPLY ACTIVE · SUIT O₂ CONSERVED';
      else if (level === 'critical') message = 'OXYGEN CRITICAL · RETURN TO SHIP';
      else if (level === 'warning') message = 'OXYGEN LOW · RETURN TO SHIP';
      else if (level === 'caution') message = 'OXYGEN BELOW 30% · CHECK RETURN DISTANCE';
      if (message !== previousMessage) {
        warning.textContent = message;
        previousMessage = message;
      }
      const pulse = reducedMotion ? 1 : 0.85 + Math.sin(elapsed * 2) * 0.15;
      shade.style.opacity = oxygen.depleted ? '0.9' : level === 'critical' ? String(0.65 * pulse) : level === 'warning' ? '0.25' : '0';
    },
    dispose() { root.remove(); },
  };
}
