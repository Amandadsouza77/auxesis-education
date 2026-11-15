import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const pages=JSON.parse(readFileSync('content/international-pages.json','utf8'));
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const once=(s,old,replacement,label)=>{if(s.split(old).length!==2)throw Error('Expected one '+label);return s.replace(old,replacement)};
export function applyInternational(root){
 const programmes=resolve(root,'subjects-programmes/index.html'),about=resolve(root,'about-amanda/index.html');
 let template=readFileSync(programmes,'utf8');
 const links=pages.map(p=>'<a href="/'+p.slug+'/">'+escape(p.heading)+'</a>').join('');
 template=once(template,'</nav><section class="section programme-accordion-section">',links+'</nav><section class="section programme-accordion-section">','programme navigation');
 writeFileSync(programmes,template);
 let biography=readFileSync(about,'utf8');
 biography=once(biography,'<h3>Professional credentials</h3>','<h3>Professional credentials</h3><p>An Ontario Certified Teacher holding Qualified Teacher Status (QTS) in the United Kingdom.</p>','qualification heading');
 writeFileSync(about,biography);
 for(const p of pages){
  let html=template.replace(/<title>[\s\S]*?<\/title>/i,'<title>'+escape(p.title)+'</title>')
   .replace(/<meta name="description" content="[^"]*">/i,'<meta name="description" content="'+escape(p.description)+'">')
   .replace(/<link rel="canonical" href="[^"]*">/i,'<link rel="canonical" href="https://auxedu.com/'+p.slug+'/">');
  const sections=p.sections.map(([h,t])=>'<section class="section"><div class="wrap"><h2>'+escape(h)+'</h2><p>'+escape(t)+'</p></div></section>').join('');
  const related=p.related.map(([name,url])=>'<li><a href="'+url+'">'+escape(name)+'</a></li>').join('');
  const main='<main id="main"><section class="page-hero"><div class="wrap"><a class="back-link" href="/subjects-programmes/">Back to Subjects &amp; Programmes</a><p class="eyebrow">One-to-one online tutoring</p><h1>'+escape(p.heading)+'</h1><p class="lead">'+escape(p.intro)+'</p></div></section>'+sections+'<section class="section"><div class="wrap"><h2>Explore related support</h2><ul>'+related+'</ul><p><a href="/tutoring-policies/">Read the academic-integrity policy</a></p></div></section><section class="section"><div class="wrap"><h2>Discuss the student’s needs</h2><p>Share the course, examination board where relevant, and the areas where support would help. We can discuss whether Auxesis is a good fit.</p><p><a class="button" href="/enquire/">Enquire about tutoring</a></p></div></section></main>';
  html=html.replace(/<main id="main">[\s\S]*?<\/main>/,main);
  const target=resolve(root,p.slug);mkdirSync(target,{recursive:true});writeFileSync(resolve(target,'index.html'),html);
 }
 const sitemap=resolve(root,'sitemap.xml');
 if(existsSync(sitemap)){let xml=readFileSync(sitemap,'utf8');const entries=pages.map(p=>'<url><loc>https://auxedu.com/'+p.slug+'/</loc></url>').join('');xml=once(xml,'</urlset>',entries+'</urlset>','sitemap closing tag');writeFileSync(sitemap,xml)}
}
