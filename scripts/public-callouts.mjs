import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
// Owner-requested wording variants; shared styling, destinations and offer stay put.
export function applyPublicCallouts(root){
 const variants=JSON.parse(readFileSync('content/public-callouts.json','utf8'));
 const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 const decode=s=>s.replace(/<[^>]+>/g,'').replaceAll('&amp;','&').replaceAll('&#39;',"'").replaceAll('&#x27;',"'").replaceAll('&quot;','"');
 for(const [file,copy] of Object.entries(variants)){
  const path=resolve(root,file);let html=readFileSync(path,'utf8');
  for(const [tag,before,after] of [['h2',copy.beforeHeading,copy.heading],['p',copy.beforeText,copy.text]]){
   let matches=0;html=html.replace(new RegExp('<'+tag+'([^>]*)>([\\s\\S]*?)<\\/'+tag+'>','g'),(all,attrs,text)=>{if(decode(text)!==before)return all;matches++;return '<'+tag+attrs+'>'+escape(after)+'</'+tag+'>';});
   if(matches!==1)throw Error('Expected one callout '+tag+': '+file);
  }
  writeFileSync(path,html);
 }
}
