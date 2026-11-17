import {open} from './crypto.js';
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
  if(request.method==='POST'){
   // The pinned native token contains an authenticated expiry, with a 30-minute
   // lifetime. Enforce its advertised 1-second minimum age without new storage
   // or changes to the native token consumption/replay checks.
   const clone=request.clone(),reader=clone.body?.getReader();let bytes=0,parts=[];
   if(reader){while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>65536){reader.cancel().catch(()=>{});return reviewError('Your review is too large. Please shorten it.',413);}parts.push(chunk.value);}}
   let data;try{const body=new Uint8Array(bytes);let offset=0;for(const part of parts){body.set(part,offset);offset+=part.byteLength;}data=JSON.parse(new TextDecoder().decode(body));}catch{}
   if(typeof data?.form_token==='string'&&data.form_token.length<4096&&env.PORTAL_TOKEN_KEY){
    let claim;try{claim=JSON.parse(await open(env.PORTAL_TOKEN_KEY,data.form_token));}catch{}
    // Invalid tokens still go through the native validator and useful errors.
    if(claim&&Number.isFinite(claim.expires)&&typeof claim.nonce==='string'){
     const issued=claim.expires-30*60*1000;
     if(Date.now()-issued<1000)return reviewError('Please wait a moment before submitting your review.',429);
    }
   }
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

function reviewError(error,status){return new Response(JSON.stringify({error}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
