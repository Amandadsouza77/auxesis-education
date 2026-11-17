// Public canonical redirects and the exact public review endpoints only.
// Private review management, Portal, OAuth and enquiry retain their environment.
const publicPaths=new Set(['/','/about-amanda/','/about-auxesis/','/enquire/','/faq/','/how-tutoring-works/','/privacy-consent/','/recommendations/','/subjects-programmes/','/tutoring-policies/','/404.html','/404','/404/','/robots.txt','/sitemap.xml']);
export function withPublicSite(worker){return {...worker,async fetch(request,env,ctx){
 const url=new URL(request.url),normalized=url.pathname.endsWith('/')?url.pathname:url.pathname+'/';
 if(['GET','HEAD'].includes(request.method)&&url.hostname==='auxesis-education.pages.dev'&&(publicPaths.has(url.pathname)||publicPaths.has(normalized))){url.protocol='https:';url.host='auxedu.com';return Response.redirect(url.href,301);}
 // Native reviews validate SITE_URL before handling the request. Keep their
 // original validation, token issuance, storage and moderation, while giving
 // the public handler the approved custom origin (as the enquiry wrapper does).
 const publicReview=(url.pathname==='/api/reviews'&&['GET','POST'].includes(request.method))||
   (url.pathname==='/api/reviews/config'&&request.method==='GET');
 if(publicReview&&url.origin==='https://auxedu.com'&&
    ['https://auxesis-education.pages.dev','https://auxedu.com'].includes((env?.SITE_URL||'').replace(/\/$/,''))){
  return worker.fetch(request,{...env,SITE_URL:url.origin},ctx);
 }
 return worker.fetch(request,env,ctx);
}};}
