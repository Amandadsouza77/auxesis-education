import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
export function applyRecommendationsPresentation(root){
 const path=resolve(root,'recommendations/index.html');let html=readFileSync(path,'utf8');
 const once=(old,replacement)=>{if(html.split(old).length!==2)throw Error('Expected one recommendations presentation marker: '+old.slice(0,70));html=html.replace(old,replacement);};
 once('<p><a class="button" href="#review-form">Leave a review</a></p>','');
 const hero=html.match(/<section class="page-hero">[\s\S]*?<\/section>/)?.[0];
 if(!hero)throw Error('Recommendations hero missing');
 once(hero,hero+'<section class="cta-band review-invitation" aria-label="Leave a review"><div class="wrap"><a class="button" href="#review-form">Leave a review</a></div></section>');
 once('<main id="main">','<main id="main" class="recommendations-page">');
 const url='https://www.linkedin.com/in/adsouza35/';
 once('<a class="text-link" href="'+url+'" rel="noopener noreferrer" target="_blank">Read recommendations on Amanda’s LinkedIn profile</a>','');
 once('Read the complete recommendations on LinkedIn for their full context.','<a href="'+url+'" rel="noopener noreferrer" target="_blank">Read complete recommendations on LinkedIn</a> for their full context.');
 const css='<style id="recommendations-presentation">.recommendations-page>.page-hero{padding-bottom:1.5rem}.review-invitation{padding-block:1.5rem}.review-invitation .button{display:flex;width:100%;justify-content:center;white-space:normal}.recommendations-intro p{margin:0}</style>';
 once('</head>',css+'</head>');
 writeFileSync(path,html);
}
