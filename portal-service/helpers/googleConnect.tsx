import { db } from './db';
import { randomBytes,createHash } from 'crypto';
import { handleGoogleAuthorize,finalizeGoogleConnection,renderConnectionPopup,getGooglePickerConfig,getGoogleAccessToken } from '@floot/google-integrations';
const COOKIE='__Host-auxesis_google_connect';
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
const secret=()=>randomBytes(32).toString('base64url');
const cookie=(value:string,age=600)=>`${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const error=(message:string,status=403)=>Object.assign(new Error(message),{status});
async function enabled(id:string){const actor=await db.selectFrom('portalAccounts').selectAll().where('id','=',id).where('enabled','=',true).where('role','=','admin').executeTakeFirst();if(!actor)throw error('Administrator sign-in is required.');return actor;}
async function start(actor:any){
  if(actor.role!=='admin')throw error('Administrator sign-in is required.');
  const token=secret();await db.insertInto('portalAuthFlows').values({tokenHash:hash(token),phase:'google-connect-start',accountId:actor.id,nonceHash:hash(secret()),expiresAt:new Date(Date.now()+600000)}).execute();
  return {url:'https://auxesis-portal-service.floot.app/_api/auth/google_integrations_authorize?handoff='+token};
}
async function authorize(request:Request){
  const token=new URL(request.url).searchParams.get('handoff')||'';if(!/^[\w-]{43}$/.test(token))throw error('Start Google connection from the signed-in portal.');
  const flow=await db.deleteFrom('portalAuthFlows').where('tokenHash','=',hash(token)).where('phase','=','google-connect-start').where('expiresAt','>',new Date()).returningAll().executeTakeFirst();if(!flow?.accountId)throw error('Connection link expired. Start again from the portal.');
  await enabled(flow.accountId);
  const url=new URL(request.url);url.search='';url.searchParams.set('feature','calendar,driveFile');
  const reply=await handleGoogleAuthorize(new Request(url,{headers:request.headers}));const data=await reply.json();
  if(!reply.ok||!data.authorize_url)throw error('Google connection is unavailable for this service. Please try again.',503);
  const dest=new URL(data.authorize_url);if(dest.protocol!=='https:')throw error('Invalid Google authorization response.',503);
  const nonce=secret();await db.insertInto('portalAuthFlows').values({tokenHash:hash(nonce),phase:'google-connect-callback',accountId:flow.accountId,nonceHash:hash(secret()),expiresAt:new Date(Date.now()+600000)}).execute();
  return new Response('Connecting to Google…',{status:302,headers:{Location:dest.href,'Set-Cookie':cookie(nonce),'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
async function callback(request:Request){
  const nonce=(request.headers.get('Cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
  if(!/^[\w-]{43}$/.test(nonce))throw error('Start Google connection from the signed-in portal.');
  const flow=await db.deleteFrom('portalAuthFlows').where('tokenHash','=',hash(nonce)).where('phase','=','google-connect-callback').where('expiresAt','>',new Date()).returningAll().executeTakeFirst();if(!flow?.accountId)throw error('Connection request expired.');
  const actor=await enabled(flow.accountId),url=new URL(request.url),code=url.searchParams.get('connection_code');
  let payload:any;
  if(url.searchParams.has('error')||!code)payload={type:'GOOGLE_INTEGRATION_ERROR',error:'connection_cancelled'};
  else{const connection=await finalizeGoogleConnection(db,{code});payload=connection.email.toLowerCase()===actor.email.toLowerCase()?{type:'GOOGLE_INTEGRATION_SUCCESS',email:connection.email,scopes:connection.scopes}:{type:'GOOGLE_INTEGRATION_ERROR',error:'Choose the Google account used by the portal administrator.'};}
  const response=renderConnectionPopup(payload);response.headers.append('Set-Cookie',cookie('',0));response.headers.set('Cache-Control','no-store');return response;
}
async function picker(actor:any){
  if(actor.role!=='admin')throw error('Administrator sign-in is required.');
  const token=await getGoogleAccessToken(db,actor.email),config=await getGooglePickerConfig();
  return {accessToken:token.access_token,...config};
}
export const googleConnect={start,authorize,callback,picker};
