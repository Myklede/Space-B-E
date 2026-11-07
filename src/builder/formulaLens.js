// SEED: Sub-AI 1 replaces this file (keep the export and its arguments; see README-ARCH.md and the Sub-AI 1 prompt).
// Formula Lens: the five MVP formulas with the player's numbers plugged in, variables that light up parts.
import './formulaLens.css';
import { fmtInt, fmtMass } from './format.js';

export function createFormulaLens({ parent, g0, planets, balance, text, onHighlight, onGuidebook }) {
  const root = document.createElement('div');
  root.className = 'lens-root';
  parent.append(root);
  const cards = {};
  const make = (key) => {
    const t = text?.[key] ?? { title: key, formula: '', real: '', guidebook: null };
    const card = document.createElement('div');
    card.className = 'lens-card hud-panel';
    card.innerHTML = `<div class="hud-label">${t.title}</div><div class="lens-formula">${t.formula}</div><div class="lens-numbers"></div><div class="lens-result hud-value"></div><div class="lens-real">${t.real}</div>`;
    if (t.guidebook) {
      const link = document.createElement('button');
      link.className = 'lens-link';
      link.type = 'button';
      link.textContent = 'Guidebook ›';
      link.addEventListener('click', () => onGuidebook?.(t.guidebook));
      card.append(link);
    }
    root.append(card);
    cards[key] = { card, numbers: card.querySelector('.lens-numbers'), result: card.querySelector('.lens-result') };
    return cards[key];
  };
  ['weight', 'twr', 'rocketEquation', 'centerOfMass', 'deltaVBudget'].forEach(make);

  // Hover is CSS only (mouse listeners live in core/input.js); a click lights the parts behind a variable.
  function variable(label, ids) {
    const span = document.createElement('button');
    span.type = 'button';
    span.className = 'lens-var';
    span.textContent = label;
    span.title = 'Click to show these parts on the rocket';
    span.addEventListener('click', () => onHighlight?.(ids));
    return span;
  }

  function update(spec, b) {
    const s = spec.stats;
    const all = b.parts.map((p) => p.id);
    // 1 weight
    cards.weight.numbers.replaceChildren(variable(`m = ${fmtMass(s.wetMass)}`, all), document.createTextNode(` · g_earth ${planets.earth.g} / g_mars ${planets.mars.g} m/s²`));
    cards.weight.result.textContent = `${fmtInt(s.wetMass * planets.earth.g / 1000)} kN on Earth · ${fmtInt(s.wetMass * planets.mars.g / 1000)} kN on Mars`;
    // 2 twr
    const thrustSL = s.thrust * (s.ispVac ? s.ispSL / s.ispVac : 1);
    cards.twr.numbers.replaceChildren(variable(`F = ${fmtInt(thrustSL / 1000)} kN`, b.enginePartIds), document.createTextNode(' / '), variable(`m = ${fmtMass(s.wetMass)}`, all), document.createTextNode(` − ${planets.earth.g}`));
    const a = s.wetMass ? thrustSL / s.wetMass - planets.earth.g : 0;
    cards.twr.result.textContent = `a = ${a.toFixed(2)} m/s² · TWR ${s.twrEarth.toFixed(2)} ${s.twrEarth < 1 ? '(stays on the pad)' : s.twrEarth < 1.2 ? '(barely)' : ''}`;
    cards.twr.card.dataset.state = s.twrEarth < 1 ? 'bad' : s.twrEarth < 1.2 ? 'warn' : 'ok';
    // 3 rocket equation
    cards.rocketEquation.numbers.replaceChildren(document.createTextNode(`${fmtInt(s.ispVac)} · ${g0} · ln(`), variable(`${fmtMass(s.wetMass)}`, all), document.createTextNode(' / '), variable(`${fmtMass(s.dryMass)}`, all.filter((id) => !b.fuelPartIds.includes(id))), document.createTextNode(')  with '), variable(`m_fuel = ${fmtMass(s.fuelMass)}`, b.fuelPartIds));
    cards.rocketEquation.result.textContent = `Δv = ${fmtInt(s.deltaV)} m/s`;
    // 4 centre of mass
    cards.centerOfMass.numbers.textContent = `CoM at ${b.comY.toFixed(2)} m, CoP at ${b.copY.toFixed(2)} m of ${b.stackHeight.toFixed(1)} m (from the base)`;
    const stable = b.copY < b.comY;
    cards.centerOfMass.result.textContent = stable ? 'STABLE: pressure behind mass' : 'UNSTABLE: add fins at the tail';
    cards.centerOfMass.card.dataset.state = stable ? 'ok' : 'bad';
    // 5 budget
    const legs = Object.entries(b.dvNeeded).map(([k, v]) => `${k} ${fmtInt(v)}`).join(' + ');
    cards.deltaVBudget.numbers.textContent = `${legs} = ${fmtInt(b.roundTrip)} m/s round trip (${fmtInt(b.oneWay)} one-way)`;
    cards.deltaVBudget.result.textContent = `You have ${fmtInt(s.deltaV)} m/s`;
    cards.deltaVBudget.card.dataset.state = s.deltaV >= b.roundTrip ? 'ok' : s.deltaV >= b.oneWay ? 'warn' : 'bad';
  }

  function dispose() {
    root.remove();
  }

  return { update, dispose };
}
