// Build isolated public fixtures from the recorded production capture, never a release package.
import {cpSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {build} from 'esbuild';
import {applyPublicCopy} from './approved-public-copy.mjs';
for(const state of ['before','after']){
 const root='work/'+state;mkdirSync(root,{recursive:true});cpSync('public',root,{recursive:true});
 applyPublicCopy(root);
 cpSync('work/public-baseline/styles.css',root+'/styles.css');
 for(const asset of ['app.js','reviews.js','programmes.js','site-config.js'])cpSync('work/public-baseline/'+asset,root+'/'+asset);
}
for(const [source,target] of [['subjects-programmes_','subjects-programmes/index.html'],['enquire_','enquire/index.html'],['recommendations_','recommendations/index.html']])cpSync('work/public-baseline/'+source,'work/before/'+target);
cpSync('public/reviews.js','work/after/reviews.js');
// Keep the captured native enquiry-only bootstrap, replacing only public fallback text.
let app=readFileSync('work/after/app.js','utf8');
app=app.replace('Online enquiries are temporarily unavailable. Please email adsouza35@gmail.com.','Online enquiries are temporarily unavailable. Please try again later.')
 .replace("if(temporary)note.firstChild.textContent='This form is temporarily unavailable. Please email Amanda at ';", "if(temporary)note.firstChild.textContent=kind==='enquiry'?'This form is temporarily unavailable. Please try again later.':'This form is temporarily unavailable. Please email Amanda at ';");
writeFileSync('work/after/app.js',app);
console.log('Prepared public before/after fixtures only; native runtime not assembled.');

for(const state of ['before','after'])await build({entryPoints:['lib/time-zones.js'],bundle:true,format:'iife',globalName:'AuxesisTimeZones',outfile:'work/'+state+'/time-zones.js'});
