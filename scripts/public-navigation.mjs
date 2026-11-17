// Public navigation and spacing only; enquiry recipients/settings are untouched.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
export function applyPublicNavigation(root,files){
 for(const file of files){
  const path=resolve(root,file);let html=readFileSync(path,'utf8');
  let menus=0;
  html=html.replace(/<nav id="main-navigation"[\s\S]*?<\/nav>/g,nav=>{
   menus++;
   if(nav.includes('href="/faq/"'))throw Error('FAQ already in primary navigation');
   const marker='<a class="button" href="/enquire/"';
   if(nav.split(marker).length!==2)throw Error('Primary enquiry link missing');
   return nav.replace(marker,'<a href="/faq/"'+(file==='faq/index.html'?' aria-current="page"':'')+'>FAQs</a><a href="/tutoring-policies/"'+(file==='tutoring-policies/index.html'?' aria-current="page"':'')+'>Policies</a>'+marker);
  });
  if(menus!==1)throw Error('Expected one public primary menu: '+file);
  html=html.replace(/<footer\b[\s\S]*?<\/footer>/g,footer=>footer.replace(/<p><a href="mailto:adsouza35@gmail\.com">adsouza35@gmail\.com<\/a><\/p>/g,'').replace(/<nav aria-label="Footer navigation">[\s\S]*?<\/nav>/,nav=>nav.replace('<a href="/enquire/">Enquire</a>','').replace('<a href="/privacy-consent/">','<a href="/enquire/">Enquire</a><a href="/privacy-consent/">')));
  if(file==='index.html'){
   const verification=/<p class="recommendation-verification">Selected excerpts from recommendations published on LinkedIn\. <a class="text-link" href="([^"]+)" rel="noopener noreferrer" target="_blank">LinkedIn recommendations<\/a><\/p>/g;
   if([...html.matchAll(verification)].length!==1)throw Error('Expected one home recommendation verification sentence');
   html=html.replace(verification,(_,url)=>'<p class="recommendation-verification">Selected excerpts from recommendations published on <a href="'+url+'" rel="noopener noreferrer" target="_blank">LinkedIn</a>.</p>');
   let getting=0,recommendations=0;
   html=html.replace(/<section\b[^>]*>[\s\S]*?<\/section>/g,section=>{
    if(section.includes('Tutoring starts with a conversation rather than a commitment.')){
     getting++;
     section=section.replace('class="section "','class="section home-getting-started"');
     const links='<nav class="home-support-links" aria-label="Tutoring support"><a class="text-link" href="/how-tutoring-works/#smart-goals">SMART goals</a><a class="text-link" href="/how-tutoring-works/#preparation">Communication &amp; support</a></nav>';
     return section.replace(/(<div class="reading-column"><p>[\s\S]*?<\/p>)(<\/div>)/,(_,p,end)=>p+links+end);
    }
    if(section.includes('home-recommendations')){recommendations++;return section.replace('class="section "','class="section home-recommendations-section"');}
    return section;
   });
   if(getting!==1||recommendations!==1)throw Error('Expected home getting-started and recommendation sections');
   html=html.replace('</head>','<style id="home-information-spacing">.home-getting-started{padding-bottom:1.5rem}.home-getting-started+.home-recommendations-section{padding-top:1.5rem}.home-getting-started .section-heading{margin-bottom:1rem}.home-support-links{display:flex;flex-wrap:wrap;gap:.5rem 1.5rem;margin-top:1rem}.home-support-links a{font-size:1rem}</style></head>');
  }
  if(file==='how-tutoring-works/index.html'){
   const marker='<section class="statement-band">';
   if(html.split(marker).length!==2)throw Error('Expected one SMART goals statement band');
   const goals=JSON.parse(readFileSync('content/pages/how-tutoring-works.json','utf8')).blocks.find(b=>b.key==='how-tutoring-works-046')?.text;
   if(!goals)throw Error('SMART goals explanation missing');
   const escapedGoals=goals.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
   html=html.replace(marker,'<section class="statement-band smart-goals-block" id="smart-goals">')
    .replace('<p>SMART goals. Clear next steps.</p>','<h2>SMART goals. Clear next steps.</h2><p class="smart-goals-copy">'+escapedGoals+'</p>')
    .replace('<a href="#sessions">Sessions</a>','<a href="#smart-goals">SMART goals</a><a href="#sessions">Sessions</a>')
    .replace('<a href="#preparation">Preparation &amp; support</a>','<a href="#preparation">Communication &amp; support</a>');
   html=html.replace('</head>','<style id="smart-goals-presentation">.smart-goals-block{background:var(--teal-dark,#006B67);color:var(--alabaster)}.smart-goals-block h2{font:400 clamp(1.85rem,3.5vw,3rem)/1.14 var(--serif);letter-spacing:-.025em;margin:0 0 1rem;color:inherit}.smart-goals-block p.smart-goals-copy{max-width:60rem;font:400 1rem/1.68 var(--sans);letter-spacing:normal;text-wrap:pretty;margin:0}</style></head>');
   html=html.replace('Take time and message me if you would like to proceed.','Take time to consider it, then contact me if you would like to proceed.');
  }
  if(file==='about-auxesis/index.html')html=html.replace('Because the real value of education is not just what students achieve today, but what they become capable of tomorrow.','The real value of education is not just what students achieve today, but what they become capable of tomorrow.');
  if(file==='privacy-consent/index.html')html=html.replace('You can also email the contact address shown on this website directly.','You can contact Amanda using the enquiry form.')
   .replace('email Amanda at adsouza35@gmail.com.','contact Amanda using the <a href="/enquire/">enquiry form</a>.');
  if(file==='recommendations/index.html'){
   html=html.replace('<p class="delivery-note" hidden role="status">If this form is unavailable, email <a href="mailto:adsouza35@gmail.com">adsouza35@gmail.com</a>.</p>','<p class="delivery-note" hidden role="status">The review form is temporarily unavailable. Please try again later.</p>')
    .replace('<a href="/enquire/">Next: Enquire</a>','<a href="/faq/">Next: FAQs</a>');
  }
  if(file==='faq/index.html'||file==='tutoring-policies/index.html'){
   const pagination=file==='faq/index.html'?'<a href="/recommendations/">Previous: Recommendations &amp; Reviews</a><a href="/tutoring-policies/">Next: Policies</a>':'<a href="/faq/">Previous: FAQs</a><a href="/enquire/">Next: Enquire</a>';
   html=html.replace('</main>','<nav class="page-navigation" aria-label="Page navigation">'+pagination+'</nav></main>');
  }
  if(file==='enquire/index.html')html=html.replace('<a href="/recommendations/">Previous: Recommendations &amp; Reviews</a>','<a href="/tutoring-policies/">Previous: Policies</a>');
  writeFileSync(path,html);
 }
}
