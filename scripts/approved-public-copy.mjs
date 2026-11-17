import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {applySeoMetadata} from './seo-metadata.mjs';
import {applyInternational} from './international-pages.mjs';
import {applyOntario} from './ontario-pages.mjs';
import {applyProgrammeFormCorrections} from './programme-form-corrections.mjs';
import {applyPublicLinkLabels} from './public-link-labels.mjs';
const edits=JSON.parse(readFileSync('content/approved-public-corrections.json'));
const decode=s=>s.replace(/<[^>]+>/g,'').replaceAll('&amp;','&').replaceAll('&#x27;',"'").replaceAll('&#39;',"'").replaceAll('&quot;','"').replaceAll('&nbsp;',' ').replace(/\s+/g,' ').trim();
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function applyPublicCopy(root){
 for(const [file,changes] of Object.entries(edits)){
  let html=readFileSync('content/approved-baseline/'+file,'utf8');
  for(const {before,after} of changes){let count=0;html=html.replace(/<(p|h1|h2|h3)\b([^>]*)>([\s\S]*?)<\/\1>/g,(all,tag,attrs,inner)=>{if(decode(inner)!==before)return all;count++;return '<'+tag+attrs+'>'+escape(after)+'</'+tag+'>';});if(count!==1)throw Error(file+': expected one copy match, found '+count+' for '+before.slice(0,75));}
  if(file==='about-amanda.html'){
   const academic='<p>My academic background is in Biology.</p>';
   if(html.split(academic).length!==2)throw Error('Expected one redundant academic introduction');
   html=html.replace(academic,'');
   // Link the existing credential itself instead of repeating the OCT number below.
   const register=/<p><a class="text-link" href="(https:\/\/apps\.oct\.ca\/FindATeacher\/memberdetail\?id=496538)" rel="noopener noreferrer" target="_blank">Ontario College of Teachers public register \(OCT #496538\)<\/a><\/p>/g;
   const credential=/<li>(Ontario Certified Teacher \(OCT #496538\)[^<]*)<\/li>/g;
   const links=[...html.matchAll(register)];
   if(links.length!==1||[...html.matchAll(credential)].length!==1)throw Error('Expected one OCT credential and one register link');
   html=html.replace(credential,(_,text)=>'<li><a href="'+links[0][1]+'" rel="noopener noreferrer" target="_blank">'+text+'</a></li>').replace(register,'');
  }
  if(file==='home.html'){
   const summary=/<div class="actions"><a class="button secondary" href="\/about-amanda\/">About Amanda<\/a><\/div>/g;
   if([...html.matchAll(summary)].length!==1)throw Error('Expected one home biography link');
   html=html.replace(summary,'<div class="actions"><a class="button secondary" href="/about-amanda/">Experience &amp; qualifications</a></div>');
  }
  if(file==='how-tutoring-works.html'){
   let removed=0;html=html.replace(/<article\b[^>]*>[\s\S]*?<\/article>/g,a=>{if(/Parent conversation|Your Auxesis Portal/.test(a)){removed++;return '';}return a;});if(removed!==2)throw Error('Unexpected process steps');
   let i=0;html=html.replace(/(<article><span>)\d{2}(<\/span>)/g,(_,a,b)=>a+String(++i).padStart(2,'0')+b);if(i!==4)throw Error('Expected four process steps');
  }
  html=html.replaceAll('https://auxesis-education.pages.dev','https://auxedu.com');
  if(file==='enquire.html')html=html.replace('<script defer src="/app.js">','<script defer src="/time-zones.js"></script><script defer src="/app.js">');
  // Add an accessible explanation only at the timezone field, preserving form controls.
  if(file==='enquire.html')html=html.replace(/<select\b[^>]*name="timezone"[^>]*>[\s\S]*?<\/select>/,s=>s.replace('<select','<select aria-describedby="timezone-help"')+'<span id="timezone-help" class="field-hint">Choose the student’s region / city. The displayed offset is for today; the region accounts for daylight saving. Please check the suggested selection.</span>');
  if(file!=='404.html')html=applySeoMetadata(file,html);
  const target=resolve(root,file==='home.html'?'index.html':file==='404.html'?file:file.replace('.html','/index.html'));mkdirSync(dirname(target),{recursive:true});writeFileSync(target,html);
 }
 applyInternational(root);
 applyOntario(root);
 applyProgrammeFormCorrections(root);
 const detailPages=[...JSON.parse(readFileSync('content/international-pages.json')), ...JSON.parse(readFileSync('content/ontario-pages.json'))];
 applyPublicLinkLabels(root,[...Object.keys(edits).map(file=>file==='home.html'?'index.html':file==='404.html'?file:file.replace('.html','/index.html')),...detailPages.map(p=>p.slug+'/index.html')]);
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url) && process.argv[2])applyPublicCopy(process.argv[2]);

