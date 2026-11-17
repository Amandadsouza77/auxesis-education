// Public canonical redirects and the exact public review endpoints only.
// Private review management, Portal, OAuth and enquiry retain their environment.
const publicPaths=new Set(['/','/about-amanda/','/about-auxesis/','/enquire/','/faq/','/how-tutoring-works/','/privacy-consent/','/recommendations/','/subjects-programmes/','/tutoring-policies/','/404.html','/404','/404/','/robots.txt','/sitemap.xml']);
export function withPublicSite(worker){return {...worker,async fetch(request,env,ctx){
 const url=new URL(request.url),normalized=url.pathname.endsWith('/')?url.pathname:url.pathname+'/';
 if(['GET','HEAD'].includes(request.method)&&url.hostname==='auxesis-education.pages.dev'&&(publicPaths.has(url.pathname)||publicPaths.has(normalized))){url.protocol='https:';url.host='auxedu.com';return Response.redirect(url.href,301);}
 // The retained native entry validates its original production hostname.
 // Translate only public review requests after checking the browser origin.
 // Tokens, body, D1 binding and all private routes remain with the native code.
 const publicReview=(url.pathname==='/api/reviews'&&['GET','POST'].includes(request.method))||
   (url.pathname==='/api/reviews/config'&&request.method==='GET');
 if(publicReview&&url.origin==='https://auxedu.com'&&
    env?.PRODUCTION_ORIGIN==='https://auxesis-education.pages.dev'&&
    ['https://auxesis-education.pages.dev','https://auxedu.com'].includes((env.SITE_URL||'').replace(/\/$/,''))){
  const source=request.headers.get('Origin');
  if((request.method==='POST'&&source!==url.origin)||(source&&source!==url.origin)){
   return new Response(JSON.stringify({error:'This review request came from an unapproved origin.'}),{status:403,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  }
  const originalOrigin=url.origin;
  url.host='auxesis-education.pages.dev';
  const forwarded=new Request(url.href,request);
  if(source)forwarded.headers.set('Origin',url.origin);
  const referer=request.headers.get('Referer');
  if(referer){const ref=new URL(referer);if(ref.origin===originalOrigin){ref.host=url.host;forwarded.headers.set('Referer',ref.href);}}
  return worker.fetch(forwarded,env,ctx);
 }
 return worker.fetch(request,env,ctx);
}};}
