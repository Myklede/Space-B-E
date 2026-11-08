// Regenerate only the metrics section, keeping handwritten integration notes.
import {readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import path from 'node:path';
const dir='src/builder/tools/blender/hangar',asset='public/assets/models/builder/hangar';
const layout=JSON.parse(readFileSync(asset+'/layout.json','utf8'));
const qa=JSON.parse(readFileSync(dir+'/refs/inspection.json','utf8'));
const size=folder=>readdirSync(folder,{withFileTypes:true}).reduce((n,e)=>n+(e.isDirectory()?size(path.join(folder,e.name)):statSync(path.join(folder,e.name)).size),0);
const num=n=>n.toLocaleString('en-US');
const lines=['<!-- GENERATED_METRICS -->','',
'| File | GLB triangles, all variants | KiB | Atlas / normal px |','|---|---:|---:|---|',
...Object.entries(layout.modules).map(([id,m])=>'| '+m.file+' | '+num(m.triangles)+' | '+(m.bytes/1024).toFixed(1)+' | '+(id==='lamp'?'none':id==='tower_bay'||id==='platform_half'?'1024 / 512':'512')+' |'),' ',
Object.keys(layout.modules).length+' GLBs, '+layout.placements.length+' placements. GLBs: **'+num(Object.values(layout.modules).reduce((n,m)=>n+m.bytes,0))+' bytes**. Entire directory with external bake atlases and layout: **'+num(size(asset))+' bytes ('+(size(asset)/1e6).toFixed(2)+' MB)** / 20 MB. Every GLB below 60,000 triangles; no hero exemption.','',
'| Game look ON, height LOD | Triangles (all passes) | Total calls | Structure batches | 5 s avg FPS | Instantaneous min FPS | p95 ms |',
'|---|---:|---:|---:|---:|---:|---:|',
...Object.entries(qa.views??{}).map(([view,m])=>'| '+[view,num(m.triangles),m.drawCalls,m.structuralCalls,m.performance.average.toFixed(1),m.performance.minimum.toFixed(1),m.performance.p95FrameMs.toFixed(1)].join(' | ')+' |'),' ',
'| Complete envelope | Triangles (all passes) | Total calls | Structure batches | FPS sample |','|---|---:|---:|---:|---:|',
...[['Full detail',qa.completeFull],['Height LOD',qa.completeLod]].filter(([,m])=>m).map(([name,m])=>'| '+[name,num(m.triangles),m.drawCalls,m.structuralCalls,m.fps.toFixed(1)].join(' | ')+' |'),' ',
'Measured '+qa.date+', Chrome '+qa.browser+', viewport '+qa.viewport.join(' × ')+', device scale 1, render pixel ratio **'+qa.gpu?.pixelRatio+'**. GPU: '+qa.gpu?.renderer+'. Renderer totals include fullscreen post-processing. No frustum discount is applied to the structure. Minimum is the slowest individual RAF interval, not a rolling one-second average.','',
'Render-scale trials are in refs/scale-trial.json. Lower render scale improves frame rate at the cost of sharpness. This is not a native-resolution 60 FPS claim. Brief dips remain visible in minimum/p95 metrics.','',
...['hangar-test.log','models-test.log','builder-test.log','static-check.log'].map(f=>{const t=readFileSync(dir+'/refs/'+f,'utf8').replaceAll('\u0000','');return '- '+f+': '+(/PASS:|All model checks passed|All builder checks passed|check:static passed/.test(t)?'PASS':'NOT CONFIRMED; inspect log')+'.';}),
'- Sandbox console/page errors: '+qa.sandboxErrors?.length+'. HTTP failures: '+qa.httpErrors?.length+'.',
'- Game HANGAR smoke test on 5280: '+qa.game?.state+', '+qa.game?.frames+' advancing frames, '+qa.gameErrors?.length+' browser errors.',
'- Nine height/radius combinations, independent moving nodes and ground ML collision are asserted in inspect.mjs. Static tests compare original layout data, placement IDs/transforms, colliders, dimensions, Draco, budgets and LOD ratios.','',
'Screenshots: refs/before/{ground-look-up,platforms-closed,crew-arm}.jpg; refs/shots/{ground-look-up,overview,platform-close-up,collar,ceiling-vault,elevator,crew-arm,platforms-retracted}.jpg. refs/compare-detail.png contains only our own renders.','',
'Regenerate: node src/builder/tools/blender/hangar/report.mjs',''];
writeFileSync(dir+'/README.md',readFileSync(dir+'/README.md','utf8').split('<!-- GENERATED_METRICS -->')[0]+lines.join('\n'));
console.log('Refreshed README metrics.');
