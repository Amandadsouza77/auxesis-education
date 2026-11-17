// Public presentation corrections only. Native form handlers and private settings stay intact.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
export function applyProgrammeFormCorrections(root){
 const file=resolve(root,'subjects-programmes/index.html');
 let html=readFileSync(file,'utf8');
 let groups=0;
 html=html.replace(/(?:<p><a class="text-link" href="\/(?:ib-biology-tutoring|ib-chemistry-tutoring|a-level-biology-tutoring|gcse-igcse-science-tutoring|ontario-grade-9-10-science-tutoring|ontario-grade-11-12-biology-chemistry-tutoring)\/">[^<]+<\/a><\/p>)+/g,links=>{groups++;return '<div class="programme-links">'+links+'</div>';});
 if(groups!==5)throw Error('Expected five programme link groups; compare current source.');
 const supportSections=[...html.matchAll(/<section\b[^>]*>[\s\S]*?<\/section>/g)].filter(m=>m[0].includes('<h2>What support can include.</h2>'));
 if(supportSections.length!==1)throw Error('Expected one shared programme support introduction');
 const support=supportSections[0][0];html=html.replace(support,'');
 const intro=support.replace(/<section class="[^"]*"/,'<section class="section programme-support"');
 const nav='<nav class="programme-nav wrap"';
 if(html.split(nav).length!==2)throw Error('Expected one programme navigation');
 html=html.replace(nav,intro+nav);

 const css=`<style id="programme-spacing">
/* One spacing scale for every programme, including sections without links. */
.programme-support{padding-block:2rem 0}
.programme-support h2{font-size:clamp(1.45rem,3vw,2rem);margin-bottom:.75rem}
.programme-accordion-section{padding-block:0 2rem}
.programme-disclosure{margin:0}
.programme-disclosure summary{padding-block:1.25rem}
.programme-details{padding-block:0 1.5rem}
.programme-details p{margin:0 0 1rem}
.programme-details h3{margin-block:0 .75rem}
.programme-details .programme-links{display:flex;flex-direction:column;align-items:flex-start;gap:.5rem}
.programme-details .programme-links p,.programme-details p:last-child{margin:0}
.programme-accordion-section+.section{padding-top:2rem}
</style>`;
 if(!html.includes('</head>'))throw Error('Programme head missing');
 writeFileSync(file,html.replace('</head>',css+'</head>'));

 // Detail pages used the global 4.5rem padding on both sides of every
 // adjacent section. Scope compact spacing to all six subject/course pages.
 const detailPages=[...JSON.parse(readFileSync('content/international-pages.json')), ...JSON.parse(readFileSync('content/ontario-pages.json'))];
 const detailCss=`<style id="subject-detail-spacing">
.subject-detail-page>.section{padding-block:1.5rem}
.subject-detail-page>.section+.section{padding-top:0}
.subject-detail-page>.page-hero+.section{padding-top:2rem}
.subject-detail-page>.section h2,.subject-detail-page>.section h3{margin-bottom:.75rem}
/* Match the heading scale on the parent Subjects & Programmes page. */
.subject-detail-page>.section h2{font-size:clamp(1.45rem,3vw,2rem)}
.subject-detail-page .subject-topic h3,.subject-detail-page .ontario-courses>.wrap>h3{font-size:clamp(1.15rem,2.25vw,1.5rem);line-height:1.2;margin-bottom:.5rem}
.subject-topic-list{display:grid;gap:1.25rem}
.subject-detail-page .subject-topic>:last-child{margin-bottom:0}
.subject-detail-page>.section p{margin-block:0 .75rem}
.subject-detail-page>.section>.wrap>:first-child{margin-top:0}
.subject-detail-page>.section>.wrap>:last-child,.subject-detail-page .ontario-skill-grid article>:last-child,.subject-detail-page .ontario-course-body>:last-child,.subject-detail-page .ontario-topic>:last-child{margin-bottom:0}
.subject-detail-page .ontario-topic{margin-top:.75rem}
</style>`;
 for(const page of detailPages){
  const target=resolve(root,page.slug,'index.html');let detail=readFileSync(target,'utf8');
  if(detail.split('<main id="main">').length!==2)throw Error('Expected one detail main: '+page.slug);
  detail=detail.replace('<main id="main">','<main id="main" class="subject-detail-page">').replace('</head>',detailCss+'</head>');
  writeFileSync(target,detail);
 }
 const enquiry=resolve(root,'enquire/index.html');
 html=readFileSync(enquiry,'utf8');
 let removed=0;
 html=html.replace(/<p><a href="mailto:adsouza35@gmail\.com">adsouza35@gmail\.com<\/a><\/p>/g,()=>{removed++;return '';});
 if(removed!==2)throw Error('Expected personal email in enquiry aside and footer.');
 const note='<p class="delivery-note" hidden role="status">If this form is unavailable, email <a href="mailto:adsouza35@gmail.com">adsouza35@gmail.com</a>.</p>';
 if(!html.includes(note))throw Error('Expected enquiry availability note.');
 html=html.replace(note,'<p class="delivery-note" hidden role="status">The enquiry form is temporarily unavailable. Please try again later.</p>');
 if(html.includes('adsouza35@gmail.com'))throw Error('Personal address still present on enquiry page.');
 writeFileSync(enquiry,html);
 writeFileSync(resolve(root,'reviews.js'),readFileSync(fileURLToPath(new URL('../public/reviews.js',import.meta.url))));
}
