// Destination labels and programme names for public pages only.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const labels=new Map([
 ['See current subjects and programmes','Subjects & Programmes'],
 ['See subjects and programmes','Subjects & Programmes'],
 ['Read about online sessions','Online sessions'],
 ['Read the full tutoring policies','Tutoring policies'],
 ['Read the academic-integrity policy','Academic integrity policy'],
 ['View my LinkedIn profile','LinkedIn profile'],
 ['Read recommendations on my LinkedIn profile','LinkedIn recommendations'],
 ['Read recommendations on Amanda’s LinkedIn profile','LinkedIn recommendations'],
 ['Go to the enquiry form','Enquiry form'],
 ['Privacy & Consent information','Privacy & Consent']
]);
const decode=s=>s.replaceAll('&amp;','&').replaceAll('&#39;',"'").replaceAll('&#x27;',"'");
const escape=s=>s.replaceAll('&','&amp;');
export function applyPublicLinkLabels(root,files){
 for(const file of files){
  const path=resolve(root,file);let html=readFileSync(path,'utf8');
  if(file==='subjects-programmes/index.html'){
   const old='Because Combined and Coordinated Science structures vary, send the examination board or relevant topics with your enquiry so I can confirm suitability.';
   if(html.split(old).length!==2)throw Error('Expected one Combined/Coordinated Science suitability sentence');
   html=html.replace(old,'Combined and Coordinated Science courses vary by examination board. Please include the examination board and relevant topics in your enquiry so I can confirm suitability.');
  }
  html=html.replace(/(<a\b[^>]*>)([^<]+)(<\/a>)/g,(all,start,text,end)=>labels.has(decode(text))?start+escape(labels.get(decode(text)))+end:all);
  const displayName=text=>text.replace(/GCSE\s*(?:\/|and)\s*IGCSE/g,'GCSE &amp; IGCSE').replace(/AS (?:and|\/) (?=A-Level|$)/g,'AS &amp; ');
  // Preserve the existing submitted option values when changing visible labels.
  html=html.replace(/<option([^>]*)>([^<]*)<\/option>/g,(all,attrs,text)=>displayName(text)!==text&&!/\bvalue=/.test(attrs)?'<option'+attrs+' value="'+escape(decode(text)).replaceAll('"','&quot;')+'">'+text+'</option>':all);
  // URLs, configuration and genuine quoted recommendations are untouched.
  html=html.split(/(<figure class="recommendation-card">[\s\S]*?<\/figure>)/g).map((part,i)=>i%2?part:part.replace(/>([^<]*)</g,(_,text)=>'>'+displayName(text)+'<')).join('');
  html=html.replace(/(<meta name="description" content=")([^"]*)(")/g,(_,start,text,end)=>start+displayName(text)+end);
  writeFileSync(path,html);
 }
}
