// Versioned inspection scenes. Reviewed v2/v3 implementations and assets remain intact.
const version=new URLSearchParams(location.search).get('v')??'4';
await import(version==='2'?'./role1.hangar.v2.js':version==='3'?'./role1.hangar.v3.js':'./role1.hangar.v4.js');
