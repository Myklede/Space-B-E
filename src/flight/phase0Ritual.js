import { CHECKLIST_STEPS, PHASE0_TIMING as T, aimInfo, boardingPath, buildPoll, createChecklist, fallbackLabel, nextButtonId, phase0Plan, pollLinesShown, promptAt, scrubAvailable, scrubFee } from './phase0.js';
import phase0Data from './phase0.json' with { type: 'json' };
const copy = phase0Data.copy;

import { createPhase0Panel } from './hud/phase0Panel.js';

// Wall-clock timing is deliberate: the game loop clamps dt on slow renderers.
export function createPhase0Ritual({ parent, hud, input, audio, graphics, cinematic, contract, economy, ship, attempt, data, getSite, getCockpit, hasButton, setBoardingView, onCountdown, onScrub, now = () => performance.now() / 1000, createPanel = createPhase0Panel }) {
  const panel = createPanel({ parent, flightHud: hud });
  const checklist = createChecklist();
  const poll = buildPoll(ship, { needDv: Object.values(economy.balance.deltaVKmS ?? {}).reduce((a, b) => a + b, 0) * 1000 || 5400 });
  const plan = phase0Plan({ attempt, data });
  let stage = 'waiting', since = now(), disposed = false, generation = 0, shown = 0;
  let o2FlowStarted = false;
  const sound = (id) => {
    const chosen = audio.ids().includes(id) ? id : 'ui.click';
    if (chosen === 'suit.o2flow') o2FlowStarted = true;
    audio.play(chosen);
  };
  const stopO2Flow = () => { if (o2FlowStarted) { audio.stop('suit.o2flow'); o2FlowStarted = false; } };
  const setStage = (value) => { stage = value; since = now(); panel.root.dataset.stage = value; if (value !== 'checklist') panel.setReticle?.(null); };
  const buttons = () => (getCockpit?.() ?? getSite()?.cockpit)?.userData;
  const found = (step) => !hasButton || hasButton(step.id) !== false; // no mesh found for this id: that item falls back to its key
  let aimId = null, pending = null, pulseOn = null;
  const drawChecklist = () => {
    panel.setChecklist(CHECKLIST_STEPS.map((step, i) => ({ ...step, status: checklist.status(i), fallback: !found(step), fallbackText: fallbackLabel(step).split(' · ')[1] })));
    pulseOn = null;
    CHECKLIST_STEPS.forEach((step, i) => buttons()?.setButton?.(step.button, checklist.status(i) === 'done' ? (step.id === 'arm' ? 'red' : 'green') : checklist.status(i) === 'current' ? 'amber' : 'off'));
  };
  const stopBoarding = () => { generation++; if (stage === 'boarding') cinematic.stop(); panel.setCaption(null); };
  const seat = () => {
    stopBoarding(); setStage('seat'); panel.setKeys(null); panel.setSkip(plan.offerSkip ? copy.skip : null);
    const token = generation;
    Promise.resolve(graphics.fade({ to: 1, duration: T.seatDark })).then(() => {
      if (!disposed && token === generation && stage === 'seat') graphics.fade({ to: 0, duration: T.seatFade });
    });
    sound('crew.harness'); panel.setFact(copy.seatFact, { seconds: 0 });
  };
  const finish = () => {
    if (disposed || stage === 'done') return;
    stopO2Flow(); setStage('done'); panel.finish(); onCountdown();
  };
  const quick = () => {
    if (disposed || stage === 'done' || stage === 'quick' || stage === 'cleared') return;
    stopBoarding(); stopO2Flow(); setStage('quick'); graphics.fade({ to: 0, duration: 0 });
    panel.setChecklist([], false); panel.setFact(null); panel.setKeys(null); panel.setSkip(null);
    const warnings = poll.filter((line) => !line.go);
    panel.setPoll(warnings, { heading: warnings.length ? copy.quickWarnings : copy.quickHeading });
    panel.answer(warnings.length ? copy.quickWarningAnswer : copy.quickAnswer, warnings.length ? 'note' : 'ok');
  };
  const go = () => {
    if (disposed || stage !== 'ask') return;
    setStage('cleared'); panel.setKeys(null); panel.setSkip(null); panel.answer(copy.cleared); sound('radio.blip');
  };
  const scrub = () => {
    if (disposed || stage !== 'ask' || !scrubAvailable(contract)) return;
    const fee = scrubFee(economy.balance);
    if (!economy.canAfford(fee)) { panel.setFact(copy.insufficientFunds, { hint: true }); return; }
    economy.spend(fee, 'launch scrub'); onScrub();
  };
  // Hand animation hook (Role 3's glove): cockpit.userData.reach?.(id) -> seconds until the glove touches the button; the cockpit
  // then presses it itself. Without it the button is pressed here, at once.
  const reachSeconds = (step) => {
    const r = buttons()?.reach?.(step.id);
    return Number.isFinite(r) && r > 0 ? { delay: r, handled: true } : { delay: 0, handled: typeof buttons()?.reach === 'function' };
  };
  const apply = (step, handled) => {
    if (disposed || stage !== 'checklist') return;
    sound(step.sound); if (!handled) buttons()?.press?.(step.button); drawChecklist(); panel.setFact(step.fact);
    if (checklist.done) { setStage('poll'); panel.setChecklist([], false); panel.setReticle?.(null); panel.setKeys(null); panel.setSkip(null); panel.setPoll([]); }
  };
  // i: 0-based item. Shared by the aim-and-click path and the hidden number-key fallback.
  const trigger = (i) => {
    if (disposed || stage !== 'checklist' || pending) return;
    const result = checklist.press(i + 1);
    if (result.result === 'wrong') {
      sound('ui.error'); panel.setFact(copy.wrongOrder.replace('{next}', result.expected.name), { hint: true });
    }
    if (result.result !== 'ok') return;
    const { delay, handled } = reachSeconds(result.step);
    if (delay > 0) { pending = { at: now() + delay, step: result.step, handled }; setAim(aimId); }
    else apply(result.step, handled);
  };
  const showAim = () => {
    if (stage !== 'checklist' || pending) { panel.setReticle?.(stage === 'checklist' ? { tone: null, label: null } : null); return; }
    const step = CHECKLIST_STEPS.find((st) => st.id === aimId);
    const info = aimInfo(checklist, aimId);
    panel.setReticle?.({ tone: info.tone, label: info.label && step && found(step) ? info.label : null });
  };
  const setAim = (id) => { aimId = id ?? null; showAim(); };
  const click = () => {
    if (disposed || stage !== 'checklist' || !aimId) return false;
    const i = CHECKLIST_STEPS.findIndex((st) => st.id === aimId);
    if (i < 0 || !found(CHECKLIST_STEPS[i])) return false;
    trigger(i);
    return true;
  };
  const pulse = () => { // the next button blinks between its pending lamp colour and off
    const step = CHECKLIST_STEPS[checklist.index];
    if (!step || pending || !found(step)) return;
    const on = Math.floor(now() * 2.5) % 2 === 0;
    if (on !== pulseOn) { pulseOn = on; buttons()?.setButton?.(step.button, on ? 'amber' : 'off'); }
  };
  const offs = CHECKLIST_STEPS.map((step, i) => input.onPress(`Digit${step.key}`, () => trigger(i)));
  offs.push(input.onPress('Mouse0', click));
  offs.push(input.onPress('Enter', () => {
    if (disposed) return;
    if (stage === 'ask') go();
    else if (plan.offerSkip) quick();
    else if (stage === 'boarding' || stage === 'waiting') seat();
  }), input.onPress('KeyS', scrub));
  panel.setCaption(copy.captionTop, copy.caption);
  panel.setKeys(copy.boardNow);
  panel.setSkip(plan.offerSkip ? copy.skip : null);
  if (plan.quick) quick();
  return {
    get active() { return !disposed && stage !== 'done'; },
    get stage() { return stage; },
    get boarding() { return stage === 'boarding'; },
    get objective() { return ['poll', 'ask', 'cleared', 'quick'].includes(stage) ? copy.objectiveGo : copy.objectiveChecklist; },
    skip: quick,
    setAim, click,
    get nextButton() { return nextButtonId(checklist); },
    update() {
      if (disposed || stage === 'done') return;
      if (pending && now() >= pending.at) { const p = pending; pending = null; apply(p.step, p.handled); showAim(); }
      if (stage === 'checklist') pulse();
      const elapsed = now() - since;
      if (stage === 'waiting') {
        const site = getSite();
        if (site) {
          setStage('boarding'); setBoardingView(site); panel.setKeys(copy.boardSkip);
          const token = ++generation;
          cinematic.play({ camera: site.camera, cameraPath: boardingPath(site.rocketBase, site.eyeY), duration: T.board })
            .then(() => { if (!disposed && token === generation && stage === 'boarding') seat(); });
        } else if (elapsed >= 5) seat(); // failed or slow site warm-up must never trap the player
      } else if (stage === 'boarding' && elapsed >= T.board) seat();
      else if (stage === 'seat' && elapsed >= T.seatDark + T.seatFade + T.seatSettle) {
        setStage('checklist'); panel.setFact(copy.checklistFact, { seconds: 0 }); drawChecklist(); panel.setKeys(copy.checklistKeys); showAim();
      } else if (stage === 'poll') {
        const count = pollLinesShown(elapsed, poll.length);
        if (count > shown) { shown = count; panel.setPoll(poll.slice(0, shown)); sound('gonogo.tick'); }
        if (elapsed >= promptAt(poll.length)) {
          setStage('ask'); panel.setFact(poll.some((p) => !p.go) ? copy.warningFact : copy.goFact, { seconds: 0 });
          panel.showAsk({ scrub: scrubAvailable(contract), onGo: go, onScrub: scrub });
        }
      } else if (stage === 'cleared' && elapsed >= T.cleared) finish();
      else if (stage === 'quick' && elapsed >= T.quickNoGo) finish();
    },
    dispose() { if (disposed) return; stopBoarding(); stopO2Flow(); disposed = true; offs.forEach((off) => off?.()); panel.dispose(); graphics.fade({ to: 0, duration: 0 }); },
  };
}
