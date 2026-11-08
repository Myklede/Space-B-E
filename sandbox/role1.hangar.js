// Versioned inspection scenes. v5 is the default; Codex's v4 and the reviewed v2/v3 stay intact.
const version=new URLSearchParams(location.search).get('v')??'5';
await import(version==='2'?'./role1.hangar.v2.js':version==='3'?'./role1.hangar.v3.js':version==='4'?'./role1.hangar.v4.js':'./role1.hangar.v5.js');
