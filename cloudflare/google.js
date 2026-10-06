const enc=new TextEncoder();
const b64url=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export async function sha256(v){return b64url(await crypto.subtle.digest('SHA-256',enc.encode(v)));}
export function googleScopes(){
  return ['openid','email','https://www.googleapis.com/auth/calendar.readonly','https://www.googleapis.com/auth/drive.file'];
}
export function authorizeUrl(env,{state,redirectUri,codeChallenge}){
 const q=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,redirect_uri:redirectUri,response_type:'code',scope:googleScopes().join(' '),access_type:'offline',include_granted_scopes:'true',prompt:'consent',state,code_challenge:codeChallenge,code_challenge_method:'S256'});
 return 'https://accounts.google.com/o/oauth2/v2/auth?'+q;
}
export async function exchangeCode(env,{code,redirectUri,verifier}){
 const body=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,code,grant_type:'authorization_code',redirect_uri:redirectUri,code_verifier:verifier});
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
 if(!r.ok)throw new Error('Google token exchange failed'); return r.json();
}
export async function refreshAccess(env,refreshToken){
 const body=new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,refresh_token:refreshToken,grant_type:'refresh_token'});
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});
 if(!r.ok)throw new Error('Google token refresh failed'); return r.json();
}
export async function googleJson(url,accessToken){
 const r=await fetch(url,{headers:{Authorization:'Bearer '+accessToken},signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Object.assign(new Error('Google source read failed'),{status:r.status}); return r.json();
}
// Calendar writes are intentionally absent from this module.
