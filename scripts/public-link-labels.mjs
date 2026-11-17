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
  // Change displayed names, including metadata, without touching URL paths.
  html=html.replace(/GCSE\s*(?:\/|and)\s*IGCSE/g,'GCSE &amp; IGCSE')
   .replace(/AS and (?=(?:<span class="keep-together">)?A-Level)/g,'AS &amp; ');
  writeFileSync(path,html);
 }
}
