import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {applyOntario} from '../scripts/ontario-pages.mjs';
import {addOntarioRoutes} from '../scripts/international-public-wrapper.mjs';

const pages=JSON.parse(readFileSync('content/ontario-pages.json','utf8'));
test('two distinctive complete Ontario pages with approved skills',()=>{
 assert.equal(pages.length,2);
 assert.equal(new Set(pages.map(p=>p.slug)).size,2);
 assert.equal(pages[0].courses.length,2);
 assert.equal(pages[1].courseGroups.flatMap(g=>g.courses).length,6);
 for(const page of pages){
  assert(page.skills.some(s=>s.text.includes('analyse and interpret data')));
  assert(page.assessment.some(s=>s.includes('Deconstruct questions')));
  assert(page.cta.includes('Meet & Greet'));
  assert(page.description.length>50&&page.description.length<165);
 }
 assert(pages[0].courses.some(c=>c.code.includes('SNC1W')&&c.code.includes('De-streamed')));
 assert(pages[0].courses.some(c=>c.code.includes('SNC2D')&&c.code.includes('SNC2P')));
 assert(pages[0].mypSupport.intro.includes('specific assessment task'));
 for(const code of ['SBI3U','SBI3C','SBI4U','SCH3U','SCH4U','SCH4C'])
  assert(pages[1].courseGroups.flatMap(g=>g.courses).some(c=>c.code.includes(code)),code);
});
test('builds accessible collapsed course sections from existing public design',()=>{
 const root=mkdtempSync(resolve(tmpdir(),'auxesis-ontario-test-'));
 try{
  mkdirSync(resolve(root,'subjects-programmes'),{recursive:true});
  writeFileSync(resolve(root,'subjects-programmes/index.html'),'<html><head><title>Original</title><meta name="description" content="Original"><link rel="canonical" href="https://auxedu.com/subjects-programmes/"></head><body><header><a href="/subjects-programmes/" aria-current="page">Subjects</a></header><main id="main"><details class="programme-disclosure" id="ontario"><summary>Ontario</summary><div class="programme-details"><div><p>Ontario courses.</p></div></div></details></main><footer>Keep this footer</footer></body></html>');
  writeFileSync(resolve(root,'styles.css'),'body{margin:0}');
  writeFileSync(resolve(root,'sitemap.xml'),'<urlset><url><loc>https://auxedu.com/</loc></url></urlset>');
  applyOntario(root);
  const programmes=readFileSync(resolve(root,'subjects-programmes/index.html'),'utf8');
  for(const page of pages){
   const html=readFileSync(resolve(root,page.slug,'index.html'),'utf8');
   assert.match(programmes,new RegExp('href="/'+page.slug+'/"'));
   assert.match(html,new RegExp('<link rel="canonical" href="https://auxedu.com/'+page.slug+'/"'));
   assert.equal((html.match(/<h1>/g)||[]).length,1);
   assert(html.includes('<details class="ontario-course">'));
   assert(!html.includes('<details class="ontario-course" open'));
   assert(html.includes('Keep this footer'));
   assert(html.includes('aria-current="page"')===false);
   assert(html.includes('Deconstruct questions'));
   assert(html.includes('href="/enquire/"'));
  }
  const junior=readFileSync(resolve(root,pages[0].slug,'index.html'),'utf8');
  const senior=readFileSync(resolve(root,pages[1].slug,'index.html'),'utf8');
  assert.equal((junior.match(/<details class="ontario-course">/g)||[]).length,2);
  assert.equal((senior.match(/<details class="ontario-course">/g)||[]).length,6);
  // General teaching approach precedes both Ontario courses; MYP stays distinct near the end.
  const juniorSections=['<h2>Developing Essential Scientific Skills</h2>','<h2>Assessment Support</h2>','<h2>Explore the Courses</h2>','<span class="ontario-course-code">SNC1W','<span class="ontario-course-code">SNC2D','<h2>Building Foundations for Senior Science</h2>','<h2>Additional Support: IB MYP Science</h2>','<h2>Getting Started</h2>'];
  let last=-1;
  for(const section of juniorSections){
    const current=junior.indexOf(section);
    assert(current>last,'Junior section out of order or missing: '+section);
    last=current;
  }
  assert(!junior.includes('<strong>MYP Science Support</strong>'));
  assert(junior.includes('Explore the IB Middle Years Programme'));
  // Senior: teaching approach before courses, then assessment and progression.
  const seniorSections=[
    '<h2>Developing Advanced Scientific Skills</h2>',
    '<h3>Knowledge and Understanding</h3>',
    '<h3>Thinking and Investigation</h3>',
    '<h3>Communication</h3>',
    '<h3>Application</h3>',
    '<h2>Ontario Courses Offered</h2>',
    '<h3>Biology Tutoring</h3>',
    '<h4 class="ontario-course-heading">Grade 11 Biology<span class="ontario-course-code">SBI3U',
    '<h4 class="ontario-course-heading">Grade 11 Biology<span class="ontario-course-code">SBI3C',
    '<h4 class="ontario-course-heading">Grade 12 Biology<span class="ontario-course-code">SBI4U',
    '<h3>Chemistry Tutoring</h3>',
    '<h4 class="ontario-course-heading">Grade 11 Chemistry<span class="ontario-course-code">SCH3U',
    '<h4 class="ontario-course-heading">Grade 12 Chemistry<span class="ontario-course-code">SCH4U',
    '<h4 class="ontario-course-heading">Grade 12 Chemistry<span class="ontario-course-code">SCH4C',
    '<h2>Assessment Support</h2>',
    '<h2>Preparing for Further Study</h2>',
    '<h2>Getting Started</h2>'
  ];
  last=-1;
  for(const section of seniorSections){
    const current=senior.indexOf(section);
    assert(current>last,'Senior section out of order or missing: '+section);
    last=current;
  }
  assert(senior.includes('<h5>Diversity of Living Things</h5>'));
  assert(senior.includes('<h5>Organic Chemistry</h5>'));
  assert(senior.includes('<summary><h4 class="ontario-course-heading">'));
  assert(senior.includes('SCH4C'));
  assert(junior.includes('specific assessment task'));
  const sitemap=readFileSync(resolve(root,'sitemap.xml'),'utf8');
  for(const page of pages)assert(sitemap.includes(page.slug+'/</loc>'));
  assert(readFileSync(resolve(root,'styles.css'),'utf8').includes('.ontario-skill-grid'));
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('canonical wrapper includes only approved two Ontario routes',()=>{
 const source="const publicPaths=new Set(['/','/404.html']);";
 const out=addOntarioRoutes(source,pages);
 assert(out.includes("'/ontario-grade-9-10-science-tutoring/'"));
 assert(out.includes("'/ontario-grade-11-12-biology-chemistry-tutoring/'"));
 assert.throws(()=>addOntarioRoutes(source,[pages[0]]));
});
