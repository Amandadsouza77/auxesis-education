// Add only approved public programme routes when assembling the existing worker.
export function addInternationalRoutes(source,pages){
 const marker="'/404.html'";
 if(source.split(marker).length!==2)throw Error('Unexpected public worker route list');
 const names=pages.map(p=>p.slug);
 if(names.length!==4||new Set(names).size!==4||names.some(n=>!/^[a-z0-9-]+$/.test(n)))throw Error('Invalid international route list');
 const additions=names.map(n=>"'/" + n + "/',").join('');
 return source.replace(marker,additions+marker);
}
