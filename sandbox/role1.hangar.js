// Preserve the reviewed v2 look and motion without changing its implementation.
await import(new URLSearchParams(location.search).get('v')==='2'?'./role1.hangar.v2.js':'./role1.hangar.v3.js');
