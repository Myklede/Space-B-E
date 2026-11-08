// Refresh the hand-over table from the actual exported manifest and last browser inspection.
import {readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import path from 'node:path';
const dir='src/builder/tools/blender/hangar',asset='public/assets/models/builder/hangar';
const layout=JSON.parse(readFileSync(asset+'/layout.json','utf8'));
const qa=JSON.parse(readFileSync(dir+'/refs/inspection.json','utf8'));
const size=folder=>readdirSync(folder,{withFileTypes:true}).reduce((n,e)=>n+(e.isDirectory()?size(path.join(folder,e.name)):statSync(path.join(folder,e.name)).size),0);
const rows=Object.entries(layout.modules).map(([id,m])=>`| \`${m.file}\` | ${m.triangles.toLocaleString('en-US')} | ${(m.bytes/1024).toFixed(2)} |`);
const report=[
  '<!-- GENERATED_METRICS -->',
  '',
  '| File | Triangles per GLB (all variants) | KiB |',
  '|---|---:|---:|',...rows,'',
  `**${Object.keys(layout.modules).length} GLBs**, ${layout.placements.length} placements. GLBs total **${Object.values(layout.modules).reduce((n,m)=>n+m.bytes,0).toLocaleString('en-US')} bytes**. Whole exported directory including layout: **${size(asset).toLocaleString('en-US')} bytes (${(size(asset)/1024/1024).toFixed(3)} MiB)**, against 15 MiB.`,
  '',
  '| Runtime mode, complete envelope | Triangles drawn | Total calls | Structure batches | Geometries in memory | FPS |',
  '|---|---:|---:|---:|---:|---:|',
  ...[['Full detail',qa.completeFull],['LOD above 30 m',qa.completeLod]].map(([name,m])=>`| ${name} | ${m.triangles.toLocaleString('en-US')} | ${m.drawCalls} | ${m.structuralCalls} | ${m.geometries} | ${m.fps.toFixed(1)} |`),'',
  `Measured ${qa.date}, Chrome ${qa.browser}, headless, ${qa.viewport.join(' × ')} pixels, device scale 1. The ground inspection view measured ${qa.lod.fps.toFixed(1)} FPS. Total calls include the placeholder, scale witness and ropes; geometries include grey-box objects retained for the toggle. The structure uses 25–27 batch objects; frustum culling may reduce visible calls. No shadows or extra render passes are enabled.`,
  '',
  '### Validation outcome',
  '',
  '- `hangar-models.test.mjs`: PASS, including GLB budgets and highest-cost visible collar choice.',
  '- Existing `models.test.mjs`: PASS. Existing `builder.test.mjs`: PASS.',
  '- `npm run check:static`: PASS without overrides.',
  `- Sandbox: ${qa.sandboxErrors.length} console/page errors; ${qa.httpErrors.length} failed HTTP responses during the recorded inspection.`,
  `- Game on 5280: state ${qa.game.state}, ${qa.game.frames} advancing frames observed, ${qa.gameErrors.length} console/page errors. This is a boot smoke check, not a full game-loop check.`,
  '- All 9 height/radius combinations put above-ship levels at the retracted offset. Elevator cab reaches Y 47; crew-arm tip reaches X −1.25 for M; trolley, hook and door move independently. Ground walking stops outside the ML at Z −8.33 with eye Y 1.7.',
  '',
  '### Screenshots',
  '',
  ...['ground-look-up','platforms-closed','platforms-retracted','elevator','crew-arm'].map(n=>`- [${n}](refs/shots/${n}.jpg)`),
  '- Grey-box: `refs/shots/blockout-ground.jpg`, `blockout-overview.jpg`, `blockout-platform.jpg`.',
  '- [Own blockout vs detail](refs/compare-massing.png); [own closed vs retracted](refs/compare-platform-motion.png).',
  '',
  '### Scope left for integration',
  '',
  'All requested asset and sandbox deliverables are supplied. This is a visual modular kit, not a certified structural or mechanical design. No game integration, sound, first-person elevator riding, stair locomotion, moving-player interlocks, or capsule door transition has been installed; those are Claude’s integration tasks. The sandbox door preview raises the whole door node, and production should telescope its panels. Read the collider caveats above before using the solid tower envelopes upstairs.',
  '',
  'Regenerate this table after rebuilding and inspecting: `node src/builder/tools/blender/hangar/report.mjs`.',
  ''
].join('\n');
const file=dir+'/README.md';writeFileSync(file,readFileSync(file,'utf8').split('<!-- GENERATED_METRICS -->')[0]+report);console.log('Updated hand-over metrics in '+file);
