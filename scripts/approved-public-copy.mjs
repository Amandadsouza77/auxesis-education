import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
const edits=JSON.parse(readFileSync('content/approved-public-corrections.json'));
const decode=s=>s.replace(/<[^>]+>/g,'').replaceAll('&amp;','&').replaceAll('&#x27;',"'").replaceAll('&#39;',"'").replaceAll('&quot;','"').replaceAll('&nbsp;',' ').replace(/\s+/g,' ').trim();
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function applyPublicCopy(root){
 for(const [file,changes] of Object.entries(edits)){
  let html=readFileSync('content/approved-baseline/'+file,'utf8');
  for(const {before,after} of changes){let count=0;html=html.replace(/<(p|h1|h2|h3)\b([^>]*)>([\s\S]*?)<\/\1>/g,(all,tag,attrs,inner)=>{if(decode(inner)!==before)return all;count++;return '<'+tag+attrs+'>'+escape(after)+'</'+tag+'>';});if(count!==1)throw Error(file+': expected one copy match, found '+count+' for '+before.slice(0,75));}
  if(file==='how-tutoring-works.html'){
   let removed=0;html=html.replace(/<article\b[^>]*>[\s\S]*?<\/article>/g,a=>{if(/Parent conversation|Your Auxesis Portal/.test(a)){removed++;return '';}return a;});if(removed!==2)throw Error('Unexpected process steps');
   let i=0;html=html.replace(/(<article><span>)\d{2}(<\/span>)/g,(_,a,b)=>a+String(++i).padStart(2,'0')+b);if(i!==4)throw Error('Expected four process steps');
  }
  html=html.replaceAll('https://auxesis-education.pages.dev','https://auxedu.com');
  if(file==='enquire.html')html=html.replace('<script defer src="/app.js">','<script defer src="/time-zones.js"></script><script defer src="/app.js">');
  // Add an accessible explanation only at the timezone field, preserving form controls.
  if(file==='enquire.html')html=html.replace(/<select\b[^>]*name="timezone"[^>]*>[\s\S]*?<\/select>/,s=>s.replace('<select','<select aria-describedby="timezone-help"')+'<span id="timezone-help" class="field-hint">Choose the student’s region / city. The displayed offset is for today; the region accounts for daylight saving. Please check the suggested selection.</span>');
  const target=resolve(root,file==='home.html'?'index.html':file==='404.html'?file:file.replace('.html','/index.html'));mkdirSync(dirname(target),{recursive:true});writeFileSync(target,html);
 }
}
if(process.argv[2])applyPublicCopy(process.argv[2]);
