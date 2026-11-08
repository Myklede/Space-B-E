// Hangar v5 decks: browser inspection, screenshots and performance. Run through the browser lock:
//   node src/builder/tools/blender/hangar/v5lock.mjs browser -- node src/builder/tools/blender/hangar/v5-decks-check.mjs [shot names...]
// Without names it takes every shot. Writes refs/shots/v5-decks-*.jpg and the JSON report to $DECKS_REPORT (default: the OS temp folder).
import {chromium} from 'playwright-core';
import {writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const refs = 'src/builder/tools/blender/hangar/refs';
const only = process.argv.slice(2);
const want = name => !only.length || only.some(o => name.startsWith(o));
const report = {date: new Date().toISOString(), shots: {}, perf: {}, fits: {}, errors: [], httpErrors: []};
const browser = await chromium.launch({channel: 'chrome', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist']});
try {
  const page = await browser.newPage({viewport: {width: 1440, height: 860}, deviceScaleFactor: 1});
  page.on('pageerror', e => report.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) report.httpErrors.push({url: r.url(), status: r.status()}); });
  const pause = ms => page.waitForTimeout(ms);
  await page.goto('http://localhost:5280/sandbox/role1.hangar.html');
  await page.waitForFunction(() => window.hangarInspect?.ready, {}, {timeout: 180000});
  await pause(2500);
  report.gpu = await page.evaluate(() => { const gl = window.hangarInspect.renderer.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); return gl.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : gl.RENDERER); });
  const h = (fn, arg) => page.evaluate(fn, arg);
  async function preset(name) {
    await h(async n => { const x = window.hangarInspect; await x.realShip.preset(n); x.params.preset = n; x.makeRocket(); x.build(); }, name);
    await pause(1500);
  }
  async function mode(m) { await h(m => { const x = window.hangarInspect; x.actions[m === 'retract' ? 'retract' : 'close'](); }, m); await pause(300); await h(() => window.hangarInspect.settle()); await pause(400); }
  async function look(pos, target, fov = 62, cutaway = false) { await h(([p, t, f, c]) => { const x = window.hangarInspect; x.params.cutaway = c; x.look(p, t, f); }, [pos, target, fov, cutaway]); await h(() => window.hangarInspect.settle()); await pause(1200); }
  async function shot(name, fixedScale = true) {
    if (fixedScale) await h(() => { const x = window.hangarInspect; x.params.autoResolution = false; x.setResolution(1); });
    await pause(700);
    const style = await page.addStyleTag({content: '.lil-gui,header,#info,aside{visibility:hidden!important}'});
    await page.screenshot({path: `${refs}/shots/v5-decks-${name}.jpg`, type: 'jpeg', quality: 85});
    await style.evaluate(e => e.remove());
    report.shots[name] = await h(() => window.hangarInspect.stats());
    await h(() => { window.hangarInspect.params.autoResolution = true; });
    console.log('shot', name, JSON.stringify(report.shots[name]));
  }
  async function perf(name) {
    await h(() => { const x = window.hangarInspect; x.params.autoResolution = true; x.params.gameLook = true; x.setLook(); });
    await pause(8000);
    const p = await h(() => window.hangarInspect.capturePerformance());
    report.perf[name] = {...p, ...(await h(() => ({...window.hangarInspect.stats(), scale: window.hangarInspect.params.renderScale})))};
    console.log('perf', name, JSON.stringify(report.perf[name]));
  }
  const turn = [-12.73, 1.7, -12.73];
  const midTarget = () => h(p => { const x = window.hangarInspect, top = x.shipData?.top ?? 30, d = Math.hypot(p[0], p[2]); const a = (Math.atan2(7 - p[1], d) + Math.atan2(7 + top - p[1], d)) / 2; return [0, p[1] + d * Math.tan(a), 0]; }, turn);
  const fits = () => h(() => window.hangarInspect.collars.fits.map(l => Object.fromEntries(Object.entries(l).map(([k, f]) => [k, f.retract ? 'R' : Math.min(...f.radii).toFixed(2) + '-' + Math.max(...f.radii).toFixed(2)]))));

  // State the page must be in for a step; re-applied after a Vite reload (other agents edit files while we run).
  let state = {ship: 'Reliable', cylinder: 0, platforms: 'close'};
  async function apply() {
    if (state.cylinder) await h(hgt => { const x = window.hangarInspect; x.params.realShip = false; x.params.height = hgt; x.makeRocket(); x.build(); }, state.cylinder);
    else { await h(() => { const x = window.hangarInspect; x.params.realShip = true; }); await preset(state.ship); }
    await mode(state.platforms);
  }
  async function step(name, fn) {
    if (!want(name) && !(name === 'perf' && want('perf'))) return;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { await fn(); return; } catch (error) {
        if (!/context was destroyed|navigation|Target closed/i.test(String(error))) throw error;
        console.log('reload during', name, '- retrying');
        await page.waitForFunction(() => window.hangarInspect?.ready, {}, {timeout: 180000}); await pause(2500); await apply();
      }
    }
  }
  const overview = [[-13, 58, -13], [2, 20, 2], 66];
  await apply();
  report.fits.Reliable = await fits();
  // 1. Wrap overview from high in the open quarter (front-left diagonal), as in the reference painting.
  await step('overview', async () => { await look(...overview); await shot('overview'); });
  await step('perf', async () => { await look(...overview); await perf('overview'); });
  // 2. Turnaround: ground eye at the 18 m bank, looking up through the open quarter.
  await step('turnaround', async () => { await look(turn, await midTarget(), 70); await shot('turnaround'); });
  await step('perf', async () => { await look(turn, await midTarget(), 70); await perf('turnaround'); });
  // A/B: what the decks part costs in the turnaround view (decks + collar hidden vs shown), fixed scale 1.
  await step('ab', async () => {
    await look(turn, await midTarget(), 70);
    const toggle = on => h(on => { const x = window.hangarInspect; x.collars.mesh.visible = on; x.scene.traverse(o => { if (o.isInstancedMesh && /deck_quad_v5|deck_v5|deck_track_v5/.test(o.material?.name ?? '')) o.visible = on; }); }, on);
    await h(() => { const x = window.hangarInspect; x.params.autoResolution = false; x.setResolution(1); });
    report.ab = {};
    for (const [label, on] of [['with', true], ['without', false], ['with2', true]]) {
      await toggle(on); await pause(3000);
      report.ab[label] = {...await h(() => window.hangarInspect.capturePerformance()), ...(await h(() => window.hangarInspect.stats()))};
      console.log('ab', label, JSON.stringify(report.ab[label]));
    }
    await toggle(true); await h(() => { window.hangarInspect.params.autoResolution = true; });
  });
  // 3. Under-deck look-up from the ground under fr, outside the launcher.
  await step('underdeck', async () => { await look([10.5, 1.7, -1.5], [4, 22, -7], 72); await shot('underdeck'); });
  // 4. Closed vs retracted per segment: a tall cylinder keeps every level closed.
  for (const m of ['close', 'retract']) {
    state = {...state, cylinder: 63, platforms: m};
    for (const [id, target] of [['fr', [7, 38, -7]], ['br', [7, 38, 8]], ['bl', [-8, 38, 7]]])
      await step(id, async () => { await apply(); await look([-9, 44, -9], target, 66); await shot(`${id}-${m}`); });
    await step('tall', async () => { await apply(); await look(...overview); await shot(`tall-${m}`); });
  }
  state = {ship: 'Reliable', cylinder: 0, platforms: 'close'};
  // 5. Collars hugging three real ships, seen from above inside the open quarter.
  for (const name of ['Reliable', 'Apollo', 'Workhorse']) {
    await step('collar', async () => {
      state.ship = name; await apply();
      report.fits[name] = await fits();
      const lv = await h(() => { const x = window.hangarInspect, top = 7 + (x.shipData?.top ?? 20); const ls = x.layout.levels.map(l => l.y).filter(y => y < top - 2); return ls[Math.max(0, Math.floor(ls.length / 2) - (ls.length > 2 ? 1 : 0))] ?? 11; });
      await look([-4.2, lv + 3.6, -4.2], [.6, lv - .4, .6], 62); await shot('collar-' + name.toLowerCase());
      await look([-9, lv + 6, -9], [0, lv - 1, 0], 62); await shot('collar-' + name.toLowerCase() + '-wide');
      await look(turn, await midTarget(), 70); await shot('turnaround-' + name.toLowerCase());
    });
  }
} finally {
  await browser.close();
  writeFileSync(process.env.DECKS_REPORT ?? path.join(os.tmpdir(), 'v5-decks-check.json'), JSON.stringify(report, null, 1));
  console.log('errors', report.errors.length, report.errors.slice(0, 5), 'http', report.httpErrors.slice(0, 5));
}
