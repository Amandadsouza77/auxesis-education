// Public canonical redirects only; preserve private routes, APIs and OAuth callbacks.
const publicPaths=new Set(['/','/about-amanda/','/about-auxesis/','/enquire/','/faq/','/how-tutoring-works/','/privacy-consent/','/recommendations/','/subjects-programmes/','/tutoring-policies/','/404.html','/robots.txt','/sitemap.xml']);
export function withPublicSite(worker){return {...worker,async fetch(request,env,ctx){
 const url=new URL(request.url),normalized=url.pathname.endsWith('/')?url.pathname:url.pathname+'/';
 if(['GET','HEAD'].includes(request.method)&&url.hostname==='auxesis-education.pages.dev'&&(publicPaths.has(url.pathname)||publicPaths.has(normalized))){url.protocol='https:';url.host='auxedu.com';return Response.redirect(url.href,301);}
 return worker.fetch(request,env,ctx);
}};}
