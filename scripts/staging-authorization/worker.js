// Isolated owner consent and checksum-pinned encrypted recovery upload only.
// No business-record routes or mutation capabilities.
import {seal,open} from './crypto.js';
import {authorizeUrl,exchangeCode,googleJson,sha256} from './google.js';
const ORIGIN='https://migration-auth.auxesis-production-staging.pages.dev';
const DB='4f12fc1d-3e0d-4a11-bd65-e577ce906114';
const COOKIE='__Host-auxesis_migration_consent';
const UPLOAD_COOKIE='__Host-auxesis_recovery_upload';
const EXPECTED_SHA='557349cc77b364b156ed2fd839a144cd5048030e0d0bf781030286deedaeedf2';
const uploadCookie=(s,age)=>`${UPLOAD_COOKIE}=${s}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`;
const getCookie=(request,name)=>(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';
const hex=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');
const random=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const headers={'Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",'Referrer-Policy':'same-origin','X-Content-Type-Options':'nosniff'};
const html=(s,status=200,extra={})=>new Response('<!doctype html><meta charset="utf-8"><title>Auxesis staging authorization</title><main>'+s+'</main>',{status,headers:{...headers,'Content-Type':'text/html; charset=utf-8',...extra}});
const cookie=(s,age)=>`${COOKIE}=${s}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
export async function handle(request,env){
 const u=new URL(request.url);
 if(u.origin!==ORIGIN||env.PORTAL_DB_ID!==DB||env.PRODUCTION_SYNC_ENABLED!=='false'||env.PRODUCTION_AUTOMATION_ENABLED!=='false')return html('Staging authorization is unavailable.',503);
 if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.ADMIN_EMAIL)return html('Staging Google credentials are not configured.',503);
 if(request.method!=='GET'&&!(u.pathname==='/recovery/upload'&&request.method==='POST'))return html('Method not allowed.',405);
 const db=env.PORTAL_DB;
 const key=(await db.prepare("SELECT secret FROM portal_release_keys WHERE id='migration-transport'").first())?.secret;
 if(!key)return html('Private migration key is unavailable.',503);
 if(u.pathname==='/')return html('<h1>Auxesis staging authorization</h1><p>Connect the existing owner Google account for the isolated recovery import and read-only source verification. Production, Calendar events, invoices and payments will remain unchanged.</p><p><a href="/authorize">Continue with Google</a></p><p><a href="/recovery">Upload existing encrypted recovery file</a></p>');
 if(u.pathname==='/recovery'||u.pathname==='/recovery/upload'){
  const session=getCookie(request,UPLOAD_COOKIE),sessionHash=await sha256(session);
  const actor=await db.prepare('SELECT email FROM migration_upload_sessions WHERE token_hash=?1 AND expires_at>CURRENT_TIMESTAMP').bind(sessionHash).first();
  if(!session||!actor||actor.email!==env.ADMIN_EMAIL.toLowerCase())return html('<h1>Sign in to upload the recovery file</h1><p><a href="/authorize">Continue with Google</a></p>',401);
  if(request.method==='GET'){
   const csrf=await seal(key,JSON.stringify({purpose:'recovery-upload',sessionHash,expires:Date.now()+15*60*1000}));
   return html('<h1>Upload existing encrypted recovery file</h1><p>Choose the encrypted JSON file downloaded from your existing private Drive backup. Only the exact verified package is accepted. Production remains unchanged.</p><form action="/recovery/upload" method="post" enctype="multipart/form-data"><input type="hidden" name="csrf" value="'+csrf+'"><input type="file" name="encrypted_package" accept=".json,application/json" required><button type="submit">Verify and save encrypted file</button></form>');
  }
  if(request.headers.get('Origin')!==ORIGIN)return html('Upload origin mismatch.',403);
  if(Number(request.headers.get('Content-Length')||0)>100000)return html('The selected file is too large.',413);
  const reader=request.body?.getReader();if(!reader)return html('No upload was received.',400);
  const parts=[];let total=0;
  while(true){const part=await reader.read();if(part.done)break;total+=part.value.byteLength;if(total>100000){await reader.cancel();return html('The selected file is too large.',413);}parts.push(part.value);}
  const body=new Uint8Array(total);let offset=0;for(const part of parts){body.set(part,offset);offset+=part.length;}
  const form=await new Response(body,{headers:{'Content-Type':request.headers.get('Content-Type')||''}}).formData();
  let csrf;try{csrf=JSON.parse(await open(key,String(form.get('csrf')||'')));}catch{return html('Upload verification expired. Reopen the upload page.',403);}
  if(csrf.purpose!=='recovery-upload'||csrf.sessionHash!==sessionHash||csrf.expires<Date.now())return html('Upload verification expired. Reopen the upload page.',403);
  const file=form.get('encrypted_package');if(!file||typeof file.arrayBuffer!=='function')return html('Choose the existing encrypted JSON file.',400);
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(bytes.length!==72431||await hex(bytes)!==EXPECTED_SHA)return html('This file does not match the verified encrypted backup. No file or business records were changed.',409);
  const existing=await db.prepare("SELECT sha256 FROM migration_recovery_packages WHERE id='approved-baseline'").first();
  if(existing&&existing.sha256!==EXPECTED_SHA)return html('A different recovery package is already stored. Upload stopped.',409);
  const encoded=btoa(String.fromCharCode(...bytes));
  await db.prepare("INSERT INTO migration_recovery_packages(id,owner_email,sha256,size,encrypted_base64,uploaded_at) VALUES('approved-baseline',?1,?2,?3,?4,CURRENT_TIMESTAMP) ON CONFLICT(id) DO NOTHING").bind(actor.email,EXPECTED_SHA,bytes.length,encoded).run();
  await db.prepare('DELETE FROM migration_upload_sessions WHERE token_hash=?1').bind(sessionHash).run();
  return html('<h1>Encrypted recovery file verified and saved</h1><p>Return to the conversation to continue the isolated import. Production and business records remain unchanged.</p>',200,{'Set-Cookie':uploadCookie('',0)});
 }
 if(u.pathname==='/authorize'){
  const state=random(),verifier=random(),nonce=random(),redirectUri=ORIGIN+'/api/portal/auth/callback';
  await db.prepare("DELETE FROM migration_oauth_flows WHERE expires_at<CURRENT_TIMESTAMP").run();
  await db.prepare("INSERT INTO migration_oauth_flows(state_hash,nonce_hash,payload,expires_at) VALUES(?1,?2,?3,datetime('now','+10 minutes'))").bind(await sha256(state),await sha256(nonce),await seal(key,JSON.stringify({verifier,redirectUri}))).run();
  return new Response(null,{status:302,headers:{...headers,Location:authorizeUrl(env,{state,redirectUri,codeChallenge:await sha256(verifier)}),'Set-Cookie':cookie(nonce,600)}});
 }
 if(u.pathname==='/api/portal/auth/callback'){
  const state=u.searchParams.get('state')||'',code=u.searchParams.get('code')||'';
  const nonce=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
  const stateHash=await sha256(state),nonceHash=await sha256(nonce);
  const row=await db.prepare('DELETE FROM migration_oauth_flows WHERE state_hash=?1 AND nonce_hash=?2 AND expires_at>CURRENT_TIMESTAMP RETURNING payload').bind(stateHash,nonceHash).first();
  if(!row||!code||!nonce)return html('Authorization expired or was cancelled. Return to the staging authorization page and try again.',401,{'Set-Cookie':cookie('',0)});
  const flow=JSON.parse(await open(key,row.payload));
  if(flow.redirectUri!==ORIGIN+'/api/portal/auth/callback')return html('Authorization origin mismatch.',401);
  const tokens=await exchangeCode(env,{code,redirectUri:flow.redirectUri,verifier:flow.verifier});
  const profile=await googleJson('https://openidconnect.googleapis.com/v1/userinfo',tokens.access_token);
  if(profile.email_verified!==true||profile.email?.toLowerCase()!==env.ADMIN_EMAIL.toLowerCase())return html('Use the verified owner Google account.',403,{'Set-Cookie':cookie('',0)});
  const scopes=new Set((tokens.scope||'').split(/\s+/));
  if(!tokens.refresh_token||!scopes.has('https://www.googleapis.com/auth/drive.file')||!scopes.has('https://www.googleapis.com/auth/calendar.readonly'))return html('Google did not provide the requested continuing read access. Retry consent without changing credentials.',409,{'Set-Cookie':cookie('',0)});
  await db.prepare("INSERT INTO migration_google_authorization(id,email,refresh_token_ciphertext,scopes,client_id,updated_at) VALUES('owner',?1,?2,?3,?4,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET email=excluded.email,refresh_token_ciphertext=excluded.refresh_token_ciphertext,scopes=excluded.scopes,client_id=excluded.client_id,updated_at=CURRENT_TIMESTAMP").bind(profile.email.toLowerCase(),await seal(key,tokens.refresh_token),tokens.scope,env.GOOGLE_CLIENT_ID).run();
  const uploadSession=random();
  await db.prepare("INSERT INTO migration_upload_sessions(token_hash,email,expires_at) VALUES(?1,?2,datetime('now','+15 minutes'))").bind(await sha256(uploadSession),profile.email.toLowerCase()).run();
  const response=html('<h1>Staging authorization saved</h1><p>No Calendar events, invoices, payments or production records were changed.</p><p><a href="/recovery">Upload existing encrypted recovery file</a></p>');
  response.headers.append('Set-Cookie',cookie('',0));response.headers.append('Set-Cookie',uploadCookie(uploadSession,900));return response;
 }
 return html('Not found.',404);
}
export default {async fetch(request,env){try{return await handle(request,env);}catch{return html('Staging authorization could not complete. No business records changed. Return to the conversation for diagnosis.',503);}}};
