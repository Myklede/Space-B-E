// SEED: Sub-AI 2 replaces this file (keep the export and its arguments; see README-ARCH.md and the Sub-AI 2 prompt).
// Engine workbench: chamber (fuel) + nozzle + turbopump, with live stats from compute(def).
import { fmtInt, fmtKN, fmtMass, fmtMoney } from './format.js';

export function createWorkbench({ parent, engines, current, compute, onApply, onClose }) {
  const def = { fuel: current?.fuel ?? 'methalox', nozzle: current?.nozzle ?? 'vac', pump: current?.pump ?? 'M' };
  const root = document.createElement('div');
  root.className = 'wb-root';
  parent.append(root);

  const row = (label, key, options) => {
    const el = document.createElement('div');
    el.className = 'wb-row';
    const lab = document.createElement('span');
    lab.className = 'hud-label';
    lab.textContent = label;
    el.append(lab);
    for (const [id, opt] of Object.entries(options)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'wb-choice';
      b.textContent = opt.name ?? id;
      b.dataset.value = id;
      b.setAttribute('aria-pressed', String(def[key] === id));
      b.addEventListener('click', () => {
        def[key] = id;
        el.querySelectorAll('.wb-choice').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.value === id)));
        render();
      });
      el.append(b);
    }
    root.append(el);
  };
  row('Chamber', 'fuel', engines.fuels);
  row('Nozzle', 'nozzle', engines.nozzles);
  row('Turbopump', 'pump', engines.pumps);

  const stats = document.createElement('div');
  stats.className = 'wb-stats';
  const note = document.createElement('div');
  note.className = 'wb-note';
  const formulas = document.createElement('div');
  formulas.className = 'wb-formula';
  const actions = document.createElement('div');
  actions.className = 'bld-dialog-actions';
  const apply = document.createElement('button');
  apply.type = 'button';
  apply.className = 'hud-button';
  apply.textContent = 'APPLY';
  apply.addEventListener('click', () => onApply?.({ ...def }));
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'hud-button';
  cancel.textContent = 'CANCEL';
  cancel.addEventListener('click', () => onClose?.());
  actions.append(cancel, apply);
  root.append(stats, formulas, note, actions);

  const stat = (label, value) => `<div class="bld-stat"><span class="bld-stat-label">${label}</span><span class="bld-stat-value">${value}</span></div>`;
  function render() {
    const s = compute(def);
    stats.innerHTML = [
      stat('Thrust (vac / SL)', `${fmtKN(s.thrust)} / ${fmtKN(s.thrustSL)}`),
      stat('Isp (SL / vac)', `${fmtInt(s.ispSL)} / ${fmtInt(s.ispVac)} s`),
      stat('Mass', fmtMass(s.mass)),
      stat('Cost', fmtMoney(s.cost)),
      stat('Exhaust speed', `${fmtInt(s.veSL)} / ${fmtInt(s.veVac)} m/s`),
      stat('Fuel flow', `${s.mdotVac.toFixed(1)} kg/s`),
    ].join('');
    formulas.textContent = `v_e = Isp · g0 = ${fmtInt(s.ispVac)} · g0 = ${fmtInt(s.veVac)} m/s;  ṁ = F / v_e = ${fmtInt(s.thrust)} / ${fmtInt(s.veVac)} = ${s.mdotVac.toFixed(1)} kg/s`;
    note.textContent = `${engines.fuels[def.fuel]?.special ?? ''} ${engines.nozzles[def.nozzle]?.note ?? ''} Overheat rate at 100 %: ${s.heatRate}/s.`;
  }
  render();

  return { dispose: () => root.remove() };
}
