import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const pages=JSON.parse(readFileSync('content/international-pages.json','utf8'));
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const once=(s,old,replacement,label)=>{if(s.split(old).length!==2)throw Error('Expected one '+label);return s.replace(old,replacement)};
export function applyInternational(root){
 const programmes=resolve(root,'subjects-programmes/index.html');
 let template=readFileSync(programmes,'utf8');
 const cardLinks=[
  ['<h3>Biology — Standard & Higher Level</h3><p>We work on understanding how biological ideas connect, interpreting data, evaluating investigations and applying knowledge in unfamiliar contexts. I also provide ethical guidance for Biology Internal Assessments and Extended Essays.</p>', '<p><a class="text-link" href="/ib-biology-tutoring/">Explore IB Biology tutoring</a></p>'],
  ['<h3>Chemistry — Standard & Higher Level</h3><p>Students work on making sense of the models behind the chemistry, not just completing calculations, and on connecting explanations, evidence and chemical reasoning. Ethical guidance is also available for Chemistry <span class="keep-together">Internal Assessments.</span></p>', '<p><a class="text-link" href="/ib-chemistry-tutoring/">Explore IB Chemistry tutoring</a></p>'],
  ['<p>We work on the detail students need to know, practical and data-handling skills, and the ability to apply biological ideas and explain them clearly.</p>', '<p><a class="text-link" href="/a-level-biology-tutoring/">Explore AS and A-Level Biology tutoring</a></p>'],
  ['<p>Support is available for Biology and Chemistry, including the Biology and Chemistry components of Combined or Coordinated Science. We work from the student’s specification and school course, clearing up difficult ideas and using questions to make sure the understanding holds when it has to be applied. Because Combined and Coordinated Science structures vary, send the examination board or relevant topics with your enquiry so I can confirm suitability.</p>', '<p><a class="text-link" href="/gcse-igcse-science-tutoring/">Explore GCSE and IGCSE Biology and Chemistry tutoring</a></p>']
 ];
 for(const [anchor,link] of cardLinks) template=once(template,anchor,anchor+link,'programme detail link');
 writeFileSync(programmes,template);
 for(const p of pages){
  let html=template.replace(/<title>[\s\S]*?<\/title>/i,'<title>'+escape(p.title)+'</title>')
   .replace(/<meta name="description" content="[^"]*">/i,'<meta name="description" content="'+escape(p.description)+'">')
   .replace(/<link rel="canonical" href="[^"]*">/i,'<link rel="canonical" href="https://auxedu.com/'+p.slug+'/">');
  if(!Number.isInteger(p.topicCount)||p.topicCount<1||p.topicCount>=p.sections.length)throw Error('Expected explicit topic grouping for '+p.slug);
  const topics=p.sections.slice(0,p.topicCount).map(([h,t])=>'<article class="subject-topic"><h3>'+escape(h)+'</h3><p>'+escape(t)+'</p></article>').join('');
  const sections='<section class="section subject-topics"><div class="wrap"><h2>Topics covered</h2><div class="subject-topic-list">'+topics+'</div></div></section>'+p.sections.slice(p.topicCount).map(([h,t])=>'<section class="section"><div class="wrap"><h2>'+escape(h)+'</h2><p>'+escape(t)+'</p></div></section>').join('');
  const related=p.related.map(([name,url])=>'<li><a href="'+url+'">'+escape(name)+'</a></li>').join('');
  const main='<main id="main"><section class="page-hero"><div class="wrap"><a class="back-link" href="/subjects-programmes/">Back to Subjects &amp; Programmes</a><p class="eyebrow">One-to-one online tutoring</p><h1>'+escape(p.heading).replaceAll('A-Level','<span class="keep-together">A-Level</span>')+'</h1><p class="lead">'+escape(p.intro)+'</p></div></section>'+sections+'<section class="section"><div class="wrap"><h2>Explore related support</h2><ul>'+related+'</ul><p><a href="/tutoring-policies/">Read the academic-integrity policy</a></p></div></section><section class="section"><div class="wrap"><h2>Discuss the student’s needs</h2><p>Share the course, examination board where relevant, and the areas where support would help. We can discuss whether Auxesis is a good fit.</p><p><a class="button" href="/enquire/">'+escape(p.ctaText)+'</a></p></div></section></main>';
  html=html.replace(/<main id="main">[\s\S]*?<\/main>/,main);
  const target=resolve(root,p.slug);mkdirSync(target,{recursive:true});writeFileSync(resolve(target,'index.html'),html);
 }
 const sitemap=resolve(root,'sitemap.xml');
 if(existsSync(sitemap)){let xml=readFileSync(sitemap,'utf8');const entries=pages.map(p=>'<url><loc>https://auxedu.com/'+p.slug+'/</loc></url>').join('');xml=once(xml,'</urlset>',entries+'</urlset>','sitemap closing tag');writeFileSync(sitemap,xml)}
}
