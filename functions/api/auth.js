import {origin,json} from '../../lib/server.js';
export async function onRequestGet({request,env}){
  let site;try{site=origin(env);}catch{return json({error:'Editor login needs account configuration.'},503);}
  if(!env.GITHUB_CLIENT_ID||new URL(request.url).origin!==site)return json({error:'Editor login needs account configuration.'},503);
  const nonce=crypto.randomUUID();const url=new URL('https://github.com/login/oauth/authorize');
  url.search=new URLSearchParams({client_id:env.GITHUB_CLIENT_ID,redirect_uri:site+'/api/callback',scope:'repo',state:nonce});
  return new Response(null,{status:302,headers:{location:url.toString(),'set-cookie':`__Host-auxesis-oauth=${nonce}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,'cache-control':'no-store'}});
}
