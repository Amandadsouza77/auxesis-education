import {origin,json} from '../../lib/server.js';
export async function onRequestGet({request,env}){
  let site;try{site=origin(env);}catch{return json({error:'Editor login needs configuration.'},503);}
  const url=new URL(request.url),state=url.searchParams.get('state'),cookie=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('__Host-auxesis-oauth='))?.split('=')[1];
  const clear='__Host-auxesis-oauth=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
  function fail(message,status=400){return new Response(message,{status,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store','set-cookie':clear}});}
  if(url.origin!==site||!state||state!==cookie||!url.searchParams.get('code'))return fail('Login could not be verified. Close this window and try again.');
  if(!env.GITHUB_CLIENT_SECRET||!env.GITHUB_CLIENT_ID||!env.GITHUB_REPOSITORY)return fail('Editor login needs account configuration.',503);
  try{
    const response=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code:url.searchParams.get('code'),redirect_uri:site+'/api/callback'})});const result=await response.json();
    if(!response.ok||!result.access_token)return fail('GitHub did not complete login. Please try again.',401);
    const headers={authorization:'Bearer '+result.access_token,accept:'application/vnd.github+json','user-agent':'Auxesis-Website-Editor','X-GitHub-Api-Version':'2022-11-28'};
    const repo=await fetch('https://api.github.com/repos/'+env.GITHUB_REPOSITORY,{headers});if(!repo.ok||!(await repo.json()).permissions?.push)return fail('This GitHub account cannot edit this website.',403);
    if(env.GITHUB_ALLOWED_LOGIN){const me=await fetch('https://api.github.com/user',{headers});if(!me.ok||(await me.json()).login.toLowerCase()!==env.GITHUB_ALLOWED_LOGIN.toLowerCase())return fail('Use the website owner’s GitHub account.',403);}
    const message='authorization:github:success:'+JSON.stringify({token:result.access_token,provider:'github'}),nonce=crypto.randomUUID();const safe=value=>JSON.stringify(value).replace(/</g,'\\u003c');
    const body=`<!doctype html><html><head><title>Website editor login</title></head><body><p>Finishing login. This window will close.</p><script nonce="${nonce}">const allowed=${safe(site)};const parent=window.opener;if(parent){window.addEventListener('message',function receive(event){if(event.origin!==allowed||event.source!==parent)return;window.removeEventListener('message',receive);parent.postMessage(${safe(message)},allowed);window.close();});parent.postMessage('authorizing:github',allowed);}</script></body></html>`;
    return new Response(body,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','set-cookie':clear,'content-security-policy':`default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`,'referrer-policy':'no-referrer','x-content-type-options':'nosniff'}});
  }catch{return fail('Login is temporarily unavailable. Please try again.',502);}
}
