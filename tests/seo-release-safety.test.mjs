import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, rmSync, readdirSync, statSync} from 'node:fs';
import {join, relative} from 'node:path';
import {tmpdir} from 'node:os';
import {applyPublicCopy} from '../scripts/approved-public-copy.mjs';

test('assembled pages retain one canonical and unique titles and descriptions',()=>{
 const dir=mkdtempSync(join(tmpdir(),'auxesis-seo-check-'));
 try {
  applyPublicCopy(dir);
  const walk=d=>readdirSync(d).flatMap(n=>{const p=join(d,n);return statSync(p).isDirectory()?walk(p):[p]});
  const pages=walk(dir).filter(p=>p.endsWith('.html')); assert.equal(pages.length,15);
  const titles=new Set(),descriptions=new Set();
  for(const file of pages){
   const html=readFileSync(file,'utf8'); if(relative(dir,file)==='404.html')continue;
   const title=[...html.matchAll(/<title>(.*?)<\/title>/gi)];
   const desc=[...html.matchAll(/<meta name="description" content="([^"]*)"/gi)];
   const canonical=[...html.matchAll(/<link rel="canonical" href="([^"]*)"/gi)];
   assert.equal(title.length,1);assert.equal(desc.length,1);assert.equal(canonical.length,1);
   assert.ok(canonical[0][1].startsWith('https://auxedu.com/'));
   assert(!titles.has(title[0][1]));assert(!descriptions.has(desc[0][1]));
   titles.add(title[0][1]);descriptions.add(desc[0][1]);
  }
  const home=readFileSync(join(dir,'index.html'),'utf8');
  const scripts=[...home.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)];
  assert.equal(scripts.length,1);const schema=JSON.parse(scripts[0][1]);
  assert.equal(schema['@type'],'EducationalOrganization');assert.equal(schema.url,'https://auxedu.com/');
  assert.match(schema.logo,/^https:\/\/auxedu\.com\/assets\//);
 } finally {rmSync(dir,{recursive:true,force:true})}
});
