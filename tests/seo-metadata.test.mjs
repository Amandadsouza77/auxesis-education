import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {applySeoMetadata} from '../scripts/seo-metadata.mjs';
import {applyPublicCopy} from '../scripts/approved-public-copy.mjs';
const names=['home','about-amanda','about-auxesis','enquire','faq','how-tutoring-works','privacy-consent','recommendations','subjects-programmes','tutoring-policies'];
test('metadata changes do not change page body and remain unique',()=>{
 const titles=new Set();
 for(const name of names){const html=readFileSync(`content/approved-baseline/${name}.html`,'utf8'),out=applySeoMetadata(`${name}.html`,html);
 assert.equal(out.slice(out.indexOf('<body')),html.slice(html.indexOf('<body')));
 const title=[...out.matchAll(/<title>(.*?)<\/title>/g)];assert.equal(title.length,1);assert(!titles.has(title[0][1]));titles.add(title[0][1]);
 assert.equal([...out.matchAll(/<meta name="description"/g)].length,1);
 }
});
test('guards missing or duplicate metadata, and avoids duplicate JSON-LD',()=>{
 const h=readFileSync('content/approved-baseline/home.html','utf8');
 assert.throws(()=>applySeoMetadata('home.html',h.replace(/<title>.*?<\/title>/,'')));
 assert.throws(()=>applySeoMetadata('home.html',h.replace('</head>','<title>Duplicate</title></head>')));
 assert.throws(()=>applySeoMetadata('home.html',h.replace('</head>','<script type="application/ld+json">{}</script></head>')));
});
test('approved public assembly includes canonical metadata and retains approved content changes',()=>{
 const dir=mkdtempSync(join(tmpdir(),'auxesis-seo-'));try{applyPublicCopy(dir);
 for(const name of names){const p=name==='home'?'index.html':`${name}/index.html`;const html=readFileSync(join(dir,p),'utf8');assert.match(html,/rel="canonical" href="https:\/\/auxedu\.com\//);assert.equal([...html.matchAll(/<h1\b/g)].length,1);}
 const home=readFileSync(join(dir,'index.html'),'utf8');assert.match(home,/<title>IB Biology &amp; Chemistry Tutoring \| Auxesis Education<\/title>/);assert.equal(JSON.parse(home.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]).url,'https://auxedu.com/');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
