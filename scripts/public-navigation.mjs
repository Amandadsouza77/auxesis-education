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
   html=html.replace(marker,'<section class="statement-band" id="smart-goals">')
    .replace('<a href="#sessions">Sessions</a>','<a href="#smart-goals">SMART goals</a><a href="#sessions">Sessions</a>')
    .replace('<a href="#preparation">Preparation &amp; support</a>','<a href="#preparation">Communication &amp; support</a>');
   html=html.replace('Parents and adult students can use the enquiry form or email me directly.','Parents and adult students can use the enquiry form.')
    .replace('Take time and message me if you would like to proceed.','Take time to consider it, then contact me if you would like to proceed.');
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
