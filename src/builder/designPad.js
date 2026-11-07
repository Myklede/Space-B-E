// The Launch pad card of the design page (Role 1 agent "pad" owns this file; designPage.js only calls it).
// The pad is the ground hardware under the rocket. PHASE 0: still the old views (site, window, equipment), moved here
// unchanged from designPage.js. The pad agent replaces them: row 1 a real launch complex, row 2 its equipment.
import { padArt } from './sections/pad/art.js';
import { padState } from './sections.js';
import { fmtInt, fmtMoney, fmtMoneyShort } from './format.js';

/**
 * createPadViews(ui) → { body(view), crumb(view), summary(), artKey(dims), art(dims) }
 * ui: { assembly, sections, h, item, fact, facts, para, prosCons, primary, signed, go, back, state, sound, changed, icons, openCard,
 *       toggleFocus, getLast } (the design page's own helpers, so the card looks like the other three)
 */
export function createPadViews(ui) {
  const { assembly, sections, h, item, fact, facts, para, prosCons, primary, signed, go, back, state, sound, changed, toggleFocus, getLast } = ui;
  const pad = () => sections.pad;

  function home() {
    const st = padState(assembly, pad());
    const out = [];
    const where = h('div', 'vd-block');
    where.append(h('div', 'vd-label', '1 · Where and when'));
    where.append(item({ id: 'site', img: null, name: st.site?.name ?? 'Launch site', sub: st.site?.real ?? '', price: st.site?.fee ? fmtMoneyShort(st.site.fee) : '', onToggle: () => go({ view: 'sites' }) }));
    where.append(item({ id: 'slot', img: null, name: st.slot ? `${st.slot.name} · ${fmtInt(st.slot.tempC)} °C` : 'Launch window', sub: st.slot?.note ?? '', price: st.slot?.fee ? fmtMoneyShort(st.slot.fee) : 'free', onToggle: () => go({ view: 'slots' }) }));
    out.push(where);
    const eqBox = h('div', 'vd-block');
    eqBox.append(h('div', 'vd-label', '2 · Pad equipment'));
    for (const { eq, option } of st.equipment) eqBox.append(item({ id: `eq:${eq.key}`, img: null, name: eq.name, sub: option?.name ?? '', price: option?.fee ? fmtMoneyShort(option.fee) : 'free', onToggle: () => go({ view: 'equipment', key: eq.key }) }));
    out.push(eqBox);
    const last = getLast();
    out.push(facts(fact('Launch fees, paid at confirm', fmtMoney(last?.breakdown.launchFee ?? 0)), fact('Pad reliability', `+${((last?.breakdown.padReliability ?? 0) * 100).toFixed(1)} %`)));
    return out;
  }
  function choiceItems(options, currentId, onChoose, { subOf = (o) => o.note ?? '', priceOf = (o) => (o.fee ? fmtMoneyShort(o.fee) : 'free') } = {}) {
    return options.map((o) => {
      const open = state.focus === o.id;
      const extra = [];
      if (o.tempC != null) extra.push(fact('Temperature at the pad', `${fmtInt(o.tempC)} °C`));
      if (o.reliability) extra.push(fact('Reliability', signed(o.reliability * 100, (n) => `${n.toFixed(1)} %`), o.reliability > 0 ? 'vd-good' : 'vd-warn'));
      if (o.fee != null) extra.push(fact('Fee', o.fee ? fmtMoney(o.fee) : 'free'));
      if (o.real) extra.push(fact('Real-world reference', o.real));
      return item({
        id: o.id, img: null, name: o.name, sub: subOf(o), price: priceOf(o), on: o.id === currentId, tag: o.id === currentId ? { text: 'CHOSEN', kind: 'on' } : null,
        expanded: open, onToggle: () => toggleFocus(o.id),
        detail: open ? [para(o.note ?? ''), prosCons(o.pros, o.cons), facts(...extra)] : null,
        action: open && o.id !== currentId ? primary('CHOOSE', () => { onChoose(o); sound('ui.click'); state.focus = null; changed(); }, 'choose') : null,
      });
    });
  }
  function sites() {
    const st = padState(assembly, pad());
    return [para('Where the ship leaves from. The site sets the weather of each launch window.', 'vd-muted'), ...choiceItems(pad().sites, st.site?.id, (o) => assembly.setLaunchSite(o.id, o.slots?.[0]?.id ?? null), { subOf: (o) => o.real ?? o.note ?? '' })];
  }
  function slots() {
    const st = padState(assembly, pad());
    return [para('The soonest window is free but may be cold.', 'vd-muted'), ...choiceItems(st.site?.slots ?? [], st.slot?.id, (o) => assembly.setLaunchSlot(o.id), { subOf: (o) => `${fmtInt(o.tempC)} °C · ${o.note ?? ''}` })];
  }
  function equipment(key) {
    const st = padState(assembly, pad());
    const c = st.equipment.find((x) => x.eq.key === key);
    if (!c) { back(); return []; }
    return [para(c.eq.role ?? '', 'vd-muted'), ...choiceItems(c.eq.options, c.option?.id, (o) => assembly.setPadOption(key, o.id))];
  }

  return {
    /** The card's body for the current view ({ view: 'home' } or one of this card's own views). */
    body(v) {
      if (v.view === 'sites') return sites();
      if (v.view === 'slots') return slots();
      if (v.view === 'equipment') return equipment(v.key);
      return home();
    },
    /** Breadcrumb name of a view of this card. */
    crumb(v) {
      if (v.view === 'sites') return 'Launch site';
      if (v.view === 'slots') return 'Launch window';
      if (v.view === 'equipment') return pad().equipment?.find((e) => e.key === v.key)?.name ?? 'Equipment';
      return '';
    },
    /** The one-line summary on the closed card: { line, built, img }. */
    summary() {
      const st = padState(assembly, pad());
      return { line: `${st.site?.name?.split(',')[0] ?? 'No site'} · ${st.slot ? `${st.slot.name} · ${fmtInt(st.slot.tempC)} °C` : ''}`, built: true, img: null };
    },
    /** A key that changes whenever the pad art must be redrawn; dims: { radius, height } of the ship. */
    artKey({ radius, height }) {
      const st = padState(assembly, pad());
      return `${st.site?.id}:${st.slot?.id}:${st.equipment.map((c) => c.option?.id).join(',')}:${radius.toFixed(2)}:${height.toFixed(1)}`;
    },
    /** The pad's 3D art under a ship of these dims ({ radius, height, layout }). */
    art(dims) { return padArt(padState(assembly, pad()), dims); },
  };
}
