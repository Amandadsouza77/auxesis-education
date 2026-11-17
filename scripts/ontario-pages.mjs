// Build two approved Ontario science tutoring pages from the public site design.
// This module never deploys; it changes only the supplied output directory.
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const pages = JSON.parse(readFileSync('content/ontario-pages.json', 'utf8'));
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const para = text => '<p>'+escape(text)+'</p>';
const paragraphs = texts => texts.map(para).join('');
function replaceExactlyOnce(source, search, replacement, label){
 const matches = [...source.matchAll(search)];
 if(matches.length!==1) throw Error('Expected exactly one '+label+', found '+matches.length);
 return source.replace(search,replacement);
}
function renderCourse(course){
 const body = '<p>'+escape(course.intro)+'</p>'+
  (course.topics||[]).map(topic=>'<div class="ontario-topic"><h4>'+escape(topic.title)+'</h4><p>'+escape(topic.text)+'</p></div>').join('')+
  (course.ending?para(course.ending):'');
 return '<details class="ontario-course"><summary><span><strong>'+escape(course.title)+'</strong><span class="ontario-course-code">'+escape(course.code)+'</span></span></summary><div class="ontario-course-body">'+body+'</div></details>';
}
function renderCourseGroup(heading,courses){
 return '<section class="section ontario-courses"><div class="wrap"><h2>'+escape(heading)+'</h2><div class="faq-list ontario-course-list">'+courses.map(renderCourse).join('')+'</div></div></section>';
}
function renderPage(page,template){
 const groups=page.courseGroups||[{heading:'Explore the Courses',courses:page.courses}];
 const courseMarkup=groups.map(g=>renderCourseGroup(g.heading,g.courses)).join('');
 const skills='<section class="section ontario-skills"><div class="wrap"><h2>'+escape(page.skillsHeading)+'</h2>'+para(page.skillsIntro)+'<div class="ontario-skill-grid">'+page.skills.map(s=>'<article><h3>'+escape(s.title)+'</h3>'+para(s.text)+'</article>').join('')+'</div></div></section>';
 const assessmentSection='<section class="section ontario-assessment"><div class="wrap"><h2>Assessment Support</h2>'+paragraphs(page.assessment)+'</div></section>';
 const related='<section class="section ontario-related"><div class="wrap"><h2>Explore Related Support</h2><ul>'+page.related.map(([name,url])=>'<li><a href="'+escape(url)+'">'+escape(name)+'</a></li>').join('')+'</ul></div></section>';
 const main='<main id="main"><section class="page-hero"><div class="wrap"><a class="back-link" href="/subjects-programmes/">Back to Subjects &amp; Programmes</a><p class="eyebrow">One-to-one online tutoring</p><h1>'+escape(page.heading)+'</h1><p class="lead">'+escape(page.subheading)+'</p><h2 class="ontario-tagline">'+escape(page.strapline)+'</h2>'+paragraphs(page.intro)+'</div></section>'+courseMarkup+skills+assessmentSection+'<section class="section"><div class="wrap"><h2>'+escape(page.conclusionHeading)+'</h2>'+paragraphs(page.conclusion)+'</div></section>'+related+'<section class="section"><div class="wrap"><h2>'+escape(page.ctaHeading)+'</h2>'+para(page.cta)+'<p><a class="button" href="/enquire/">'+escape(page.ctaText)+'</a></p><p><a href="/tutoring-policies/#academic-integrity">Read the academic-integrity policy</a></p></div></section></main>';
 let html=template;
 html=replaceExactlyOnce(html,/<title>[\s\S]*?<\/title>/gi,'<title>'+escape(page.title)+'</title>',page.slug+' title');
 html=replaceExactlyOnce(html,/<meta name="description" content="[^"]*">/gi,'<meta name="description" content="'+escape(page.description)+'">',page.slug+' description');
 html=replaceExactlyOnce(html,/<link rel="canonical" href="[^"]*">/gi,'<link rel="canonical" href="https://auxedu.com/'+page.slug+'/">',page.slug+' canonical');
 html=replaceExactlyOnce(html,/<main id="main">[\s\S]*?<\/main>/gi,main,page.slug+' main');
 html=html.replace(/href="\/subjects-programmes\/" aria-current="page"/g,'href="/subjects-programmes/"');
 return html;
}
export function applyOntario(root){
 if(pages.length!==2||new Set(pages.map(p=>p.slug)).size!==2||pages.some(p=>!/^[a-z0-9-]+$/.test(p.slug)))throw Error('Expected exactly two distinct Ontario tutoring slugs');
 const programmeFile=resolve(root,'subjects-programmes/index.html');
 let programme=readFileSync(programmeFile,'utf8');
 const anchor=/(<details class="programme-disclosure" id="ontario">[\s\S]*?<div class="programme-details"><div><p>[\s\S]*?<\/p>)(<\/div><\/div><\/details>)/g;
 const linkHtml='<p><a class="text-link" href="/ontario-grade-9-10-science-tutoring/">Explore Ontario Junior Secondary Science</a></p><p><a class="text-link" href="/ontario-grade-11-12-biology-chemistry-tutoring/">Explore Ontario Senior Biology and Chemistry</a></p>';
 programme=replaceExactlyOnce(programme,anchor,(_,start,end)=>start+linkHtml+end,'Ontario programme links');
 writeFileSync(programmeFile,programme);
 for(const page of pages){
  const target=resolve(root,page.slug);
  mkdirSync(target,{recursive:true});
  writeFileSync(resolve(target,'index.html'),renderPage(page,programme));
 }
 const sitemap=resolve(root,'sitemap.xml');
 if(existsSync(sitemap)){
  let xml=readFileSync(sitemap,'utf8');
  const entries=pages.map(p=>'<url><loc>https://auxedu.com/'+p.slug+'/</loc></url>').join('');
  xml=replaceExactlyOnce(xml,/<\/urlset>/g,entries+'</urlset>','sitemap ending');
  writeFileSync(sitemap,xml);
 }
 const cssPath=resolve(root,'styles.css');
 const css=String.raw\`
/* Ontario course accordions: follow accessible native disclosure pattern. */
.ontario-course-list{max-width:none}
.ontario-course-code{display:block;color:var(--slate-violet);font:500 .9rem/1.5 var(--sans);margin-top:.3rem}
.ontario-course-body{padding:0 1rem 1rem 0;max-width:850px}
.ontario-topic{margin-top:1.2rem}
.ontario-topic h4{font:600 1.05rem/1.4 var(--sans);margin:0}
.ontario-topic p{margin-top:.35rem}
.ontario-skill-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.4rem;margin-top:1.5rem}
.ontario-skill-grid article{padding:1.5rem;border:1px solid var(--line);border-radius:12px}
.ontario-skill-grid h3{font:600 1.1rem/1.4 var(--sans)}
.ontario-tagline{font:500 1.35rem/1.5 var(--sans);margin:1.5rem 0 1rem}
.ontario-related li{margin:.45rem 0}
@media(max-width:650px){.ontario-skill-grid{grid-template-columns:1fr}.ontario-course-body{padding-right:0}}
\`;
 writeFileSync(cssPath,readFileSync(cssPath,'utf8')+'\n'+css);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)&&process.argv[2])applyOntario(process.argv[2]);
