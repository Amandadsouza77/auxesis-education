import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
// One shared source, inserted last so old page-local rules cannot drift in colour.
export function applyPublicVisualSystem(root,files){
 const css=readFileSync('public/design-system.css','utf8');
 for(const file of files){
  const path=resolve(root,file);let html=readFileSync(path,'utf8');
  if(html.includes('id="public-design-system"'))throw Error('Visual system already applied');
  html=html.replace(/<body\b([^>]*)>/,(_,attrs)=>'<body'+(/\bclass="/.test(attrs)?attrs.replace(/class="([^"]*)"/,(_,classes)=>'class="'+classes+' public-visual-system"'):attrs+' class="public-visual-system"')+'>');
  let headings=0;html=html.replace(/<h1\b([^>]*)>/g,(_,attrs)=>{headings++;const role=file==='index.html'?'public-home-title':'public-title';return '<h1'+(/\bclass="/.test(attrs)?attrs.replace(/class="([^"]*)"/,(_,classes)=>'class="'+classes+' '+role+'"'):attrs+' class="'+role+'"')+'>';});
  if(headings!==1)throw Error('Expected exactly one public H1: '+file);
  html=html.replace('</head>','<style id="public-design-system">'+css+'</style></head>');
  writeFileSync(path,html);
 }
}
