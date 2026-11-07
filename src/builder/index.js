// Role 1: Rocket Builder. Owns MENU, HANGAR and GONOGO (contract.js STATE_OWNERS). See README-ARCH.md.
// Keeps the current Assembly, recomputes the ShipSpec after every change, and is the only file here that talks to
// core (economy, setShip, requestState, events) or to the other roles.
import './builder.css';
import { graphics } from '/src/graphics/index.js';
import { audio } from '/src/audio/index.js';
import { G0, PLANETS, contract, economy, events, input, requestState, save, setShip, ui } from '/src/core/index.js';
import partsJson from './data/parts.json';
import engines from './data/engines.json';
import launch from './data/launch.json';
import text from './data/text.json';
import reliable from './data/presets/reliable.json';
import coldMorning from './data/presets/coldMorning.json';
import thinSkin from './data/presets/thinSkin.json';
import { Assembly, createCatalog } from './assembly.js';
import { computeShipSpec, engineStats } from './stats.js';
import { evaluate } from './gonogo.js';
import { fmtMoney } from './format.js';
import { createHangarScene } from './hangarScene.js';
import { createHangarScreen } from './hangarScreen.js';
import { createFormulaLens } from './formulaLens.js';
import { createGonogoView } from './gonogoView.js';
import { createWorkbench } from './workbench.js';
import { menu } from './menu.js';
import { openPauseMenu, openSettings } from './settings.js';

export { openPauseMenu, openSettings }; // other roles may open the Esc menu and settings from their states

const catalog = createCatalog(partsJson);
const PRESETS = { reliable, coldMorning, thinSkin };
const deps = { catalog, engines, launch, balance: economy.balance, planets: PLANETS, g0: G0 };

let assembly = null; // the rocket being built, kept across states
let scene = null; // the 3D hangar, built once
let screen = null; // { update, dispose } of the active state
let closePause = null;

// ---------- the current rocket ----------
function builderSave() {
  return save.load().builder ?? {};
}

function ensureAssembly() {
  if (assembly) return assembly;
  const draft = builderSave().draft;
  assembly = new Assembly(draft ?? reliable, catalog);
  if (!assembly.parts.length) assembly = new Assembly(reliable, catalog);
  return assembly;
}

function persistDraft() {
  save.update({ builder: { ...builderSave(), draft: assembly.toJSON() } });
}

function compute() {
  const result = computeShipSpec(ensureAssembly(), deps);
  const slot = result.breakdown.slot;
  const poll = evaluate(result.spec, { blocks: result.blocks, money: economy.getMoney(), fee: slot?.fee ?? 0, text, oneWay: result.breakdown.oneWay, roundTrip: result.breakdown.roundTrip });
  return { ...result, poll, fee: slot?.fee ?? 0 };
}

function loadAssembly(json) {
  assembly = new Assembly(json, catalog);
  if (!assembly.parts.length) assembly = new Assembly(reliable, catalog);
  persistDraft();
}

function hangarScene() {
  if (!scene) scene = createHangarScene();
  return scene;
}

function highlight(ids) {
  for (const partId of ids) events.emit('builder:highlightPart', { partId });
}

// ---------- HANGAR ----------
function enterHangar() {
  const a = ensureAssembly();
  const sc = hangarScene();
  graphics.setView(sc.scene, sc.camera);

  let lens = null;
  const hangar = createHangarScreen({
    assembly: a, catalog, launch, text, scene: sc, getMoney: () => economy.getMoney(), insolvencyFloor: economy.balance.insolvencyFloor ?? 0,
    hooks: {
      onChange: refresh,
      onSound: (id) => audio.play(id),
      onGonogo: () => { audio.play('ui.click'); requestState('GONOGO'); },
      onWorkbench: openWorkbench,
      onPresets: openPresets,
      onBlueprints: openBlueprints,
      onShare: openShare,
      onBankrupt: declareBankruptcy,
    },
  });
  ui.mount(hangar.el);
  lens = createFormulaLens({
    parent: hangar.lensHost, g0: G0, planets: PLANETS, balance: economy.balance, text: text.formulas,
    onHighlight: highlight, onGuidebook: (entryId) => events.emit('guidebook:open', { entryId }),
  });

  function refresh() {
    persistDraft();
    const result = compute();
    hangar.refresh(result);
    lens.update(result.spec, result.breakdown);
  }

  function openWorkbench(partId) {
    const part = a.part(partId);
    if (!part) return;
    let wb = null;
    const body = hangar.openDialog({ title: 'Engine workbench', body: null, actions: [] });
    wb = createWorkbench({
      parent: body, engines, current: part.engine, compute: (def) => engineStats(def, engines, G0),
      onApply: (def) => { a.setEngine(partId, def); audio.play('ui.snap'); wb.dispose(); hangar.closeDialog(); refresh(); },
      onClose: () => { wb.dispose(); hangar.closeDialog(); },
    });
  }

  function openPresets() {
    hangar.openDialog({
      title: 'Preset ships',
      body: (body) => {
        const list = document.createElement('div');
        list.className = 'bld-list';
        for (const [key, json] of Object.entries(PRESETS)) {
          const { spec } = computeShipSpec(new Assembly(json, catalog), deps);
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'bld-list-item';
          item.innerHTML = `<span>${json.name}</span><span class="bld-list-meta">${fmtMoney(spec.stats.cost)} · ${spec.warnings.length ? spec.warnings.length + ' warning(s)' : 'no warnings'}</span>`;
          item.addEventListener('click', () => { loadAssembly(json); hangar.closeDialog(); audio.play('ui.snap'); rebind(); });
          list.append(item);
        }
        body.append(list);
      },
      actions: [{ label: 'CLOSE' }],
    });
  }

  function openBlueprints() {
    hangar.openDialog({
      title: 'Blueprints',
      body: (body) => {
        const blueprints = builderSave().blueprints ?? [];
        const list = document.createElement('div');
        list.className = 'bld-list';
        if (!blueprints.length) list.append(Object.assign(document.createElement('div'), { className: 'bld-list-meta', textContent: 'No saved blueprints yet.' }));
        blueprints.forEach((json, index) => {
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'bld-list-item';
          item.innerHTML = `<span>${json.name}</span><span class="bld-list-meta">${json.parts?.length ?? 0} parts · load</span>`;
          item.addEventListener('click', () => { loadAssembly(json); hangar.closeDialog(); audio.play('ui.snap'); rebind(); });
          const del = document.createElement('button');
          del.type = 'button';
          del.className = 'bld-tool';
          del.textContent = 'DELETE';
          del.addEventListener('click', (e) => {
            e.stopPropagation();
            const next = blueprints.filter((_, i) => i !== index);
            save.update({ builder: { ...builderSave(), blueprints: next } });
            hangar.closeDialog();
            openBlueprints();
          });
          item.append(del);
          list.append(item);
        });
        const name = document.createElement('input');
        name.className = 'bld-input';
        name.placeholder = 'Save the current rocket as…';
        name.value = a.name;
        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'hud-button';
        saveBtn.textContent = 'SAVE BLUEPRINT';
        saveBtn.addEventListener('click', () => {
          a.rename(name.value || a.name);
          const next = [...(builderSave().blueprints ?? []).filter((b) => b.name !== a.name), a.toJSON()];
          save.update({ builder: { ...builderSave(), blueprints: next } });
          audio.play('ui.snap');
          hangar.closeDialog();
          refresh();
        });
        body.append(list, name, saveBtn);
      },
      actions: [{ label: 'CLOSE' }],
    });
  }

  function openShare() {
    hangar.openDialog({
      title: 'Share code',
      body: (body) => {
        const out = document.createElement('textarea');
        out.className = 'bld-code';
        out.readOnly = true;
        out.value = a.toShareCode();
        out.addEventListener('click', () => out.select());
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'hud-button';
        copy.textContent = 'COPY';
        copy.addEventListener('click', () => { out.select(); navigator.clipboard?.writeText(out.value).catch(() => {}); copy.textContent = 'COPIED'; });
        const inp = document.createElement('textarea');
        inp.className = 'bld-code';
        inp.placeholder = 'Paste a share code here to load it';
        const load = document.createElement('button');
        load.type = 'button';
        load.className = 'hud-button';
        load.textContent = 'LOAD CODE';
        load.addEventListener('click', () => {
          const loaded = Assembly.fromShareCode(inp.value, catalog);
          if (!loaded || !loaded.parts.length) { audio.play('ui.error'); load.textContent = 'NOT A VALID CODE'; return; }
          loadAssembly(loaded.toJSON());
          hangar.closeDialog();
          audio.play('ui.snap');
          rebind();
        });
        body.append(out, copy, inp, load);
      },
      actions: [{ label: 'CLOSE' }],
    });
  }

  function declareBankruptcy() {
    events.emit('ending:show', { endingId: contract.ENDINGS.bankrupt, cause: 'The agency can no longer afford a ship.', cost: 0, historyLessonId: null });
    requestState('ENDING');
  }

  // Loading a preset or blueprint replaces the Assembly object, so the screen is rebuilt around the new one.
  function rebind() {
    screen.dispose();
    enterHangar();
  }

  // Key handlers are unregistered in dispose, because rebind() re-enters this screen within the same state.
  const offs = [
    input.onPress('KeyZ', () => { if (a.undo()) { audio.play('ui.click'); refresh(); } }),
    input.onPress('KeyY', () => { if (a.redo()) { audio.play('ui.click'); refresh(); } }),
    input.onPress('Delete', () => { const id = hangar.selectedPart; if (id && a.remove(id).length) { audio.play('ui.click'); refresh(); } }),
    input.onPress('KeyQ', () => sc.rotateBy(-30)),
    input.onPress('KeyE', () => sc.rotateBy(30)),
    input.onPress('Enter', () => { if (a.parts.length) requestState('GONOGO'); }),
    events.on('economy:changed', () => hangar.renderMoney()),
  ];
  const esc = () => {
    if (hangar.el.querySelector('.bld-dialog-backdrop:not([hidden])')) { hangar.closeDialog(); return; }
    closePause = openPauseMenu({ onResume: () => { closePause = null; input.onEscape(esc); } });
  };
  input.onEscape(esc);
  audio.play('ambience.ship', { loop: true, volume: 0.35 });

  screen = {
    update: (dt) => hangar.update(dt),
    dispose: () => { offs.forEach((off) => off()); lens.dispose(); hangar.dispose(); audio.stop('ambience.ship'); },
  };
  refresh();
}

// ---------- GONOGO ----------
function enterGonogo() {
  const a = ensureAssembly();
  const sc = hangarScene();
  sc.setLayout(a.layout(), []);
  sc.select(null);
  graphics.setView(sc.scene, sc.camera);
  const result = compute();
  const { spec, poll, fee } = result;

  const root = document.createElement('div');
  root.className = 'gng-root hud';
  root.dataset.screen = 'gonogo';
  root.dataset.stub = 'gonogo';
  const header = document.createElement('div');
  header.className = 'gng-header';
  header.textContent = `Go / No-Go poll · ${spec.name}`;
  const consoleEl = document.createElement('div');
  consoleEl.className = 'gng-console hud-panel';
  const summary = document.createElement('div');
  summary.className = 'gng-summary';
  summary.textContent = 'Flight controllers, report. (Space skips.)';
  const actions = document.createElement('div');
  actions.className = 'gng-actions';
  root.append(header, consoleEl, summary, actions);
  ui.mount(root);

  let done = false;
  const view = createGonogoView({
    parent: consoleEl,
    lines: poll.lines,
    onReveal: (line) => audio.play(line.status === 'GO' ? 'gonogo.tick' : 'ui.error'),
    onDone: () => {
      done = true;
      const total = poll.total;
      summary.textContent = poll.canConfirm
        ? `${poll.needsOverride ? `${poll.warnings.length} NO-GO call(s). Overriding warnings is how real accidents started.` : 'All consoles GO.'} Ship ${fmtMoney(spec.stats.cost)}${fee ? ` + pad fees ${fmtMoney(fee)}` : ''} = ${fmtMoney(total)}. Funds ${fmtMoney(economy.getMoney())}.`
        : `${poll.blocks.length} hard block(s). The launch director refuses. Fix them in the hangar.`;
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'hud-button';
      back.dataset.action = 'back';
      back.textContent = 'BACK TO HANGAR [B]';
      back.addEventListener('click', () => requestState('HANGAR'));
      actions.append(back);
      if (poll.canConfirm) {
        const confirm = document.createElement('button');
        confirm.type = 'button';
        confirm.className = `hud-button ${poll.needsOverride ? 'hud-caution' : 'hud-good'}`;
        confirm.dataset.action = poll.needsOverride ? 'override' : 'confirm';
        confirm.textContent = `${poll.needsOverride ? 'OVERRIDE & LAUNCH' : 'CONFIRM & LAUNCH'} · ${fmtMoney(total)} [Enter]`;
        confirm.addEventListener('click', confirmLaunch);
        actions.append(confirm);
      }
    },
  });

  function confirmLaunch() {
    if (!done || !poll.canConfirm) return;
    if (!economy.canAfford(poll.total)) { audio.play('ui.error'); return; }
    economy.spend(poll.total, 'ship');
    setShip(spec);
    events.emit('ship:built', { shipSpec: spec });
    audio.play('ui.snap');
    requestState('PRELAUNCH');
  }

  input.onPress('Space', () => view.skip());
  input.onPress('Enter', () => (done ? confirmLaunch() : view.skip()));
  input.onPress('KeyB', () => requestState('HANGAR'));
  const esc = () => { closePause = openPauseMenu({ onResume: () => { closePause = null; input.onEscape(esc); } }); };
  input.onEscape(esc);
  audio.play('ambience.ship', { loop: true, volume: 0.35 });

  screen = {
    update: (dt) => view.update(dt),
    dispose: () => { view.dispose(); root.remove(); audio.stop('ambience.ship'); },
  };
}

// ---------- module ----------
export default {
  init() {
    events.on('builder:highlightPart', ({ partId }) => scene?.highlight([partId]));
    events.on('ending:show', ({ endingId }) => save.update({ lastEnding: endingId })); // the menu shows the last outcome
    const volume = save.load().volume;
    if (typeof volume === 'number') audio.setVolume(volume);
  },

  enter(state) {
    if (state === contract.STATES.MENU) return menu.enter();
    if (state === contract.STATES.HANGAR) return enterHangar();
    if (state === contract.STATES.GONOGO) return enterGonogo();
  },

  update(dt, state) {
    if (state === contract.STATES.MENU) return menu.update?.(dt);
    scene?.update(dt);
    screen?.update(dt);
  },

  exit(state) {
    if (state === contract.STATES.MENU) return menu.exit?.();
    closePause?.();
    closePause = null;
    screen?.dispose();
    screen = null;
  },
};
