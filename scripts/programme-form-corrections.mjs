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
 const css=`<style id="programme-spacing">
/* One spacing scale for every programme, including sections without links. */
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
