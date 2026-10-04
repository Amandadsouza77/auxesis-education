import { db } from './db';
import { sql } from 'kysely';
import { randomBytes, randomUUID, createHash } from 'crypto';
import { sendEmail, getEmailStatuses } from '@floot/email';
import { portalCore } from './portalCore';

const SITE = 'https://auxesis-education.pages.dev';
type Data = Record<string, any>;
const hash = (v:string) => createHash('sha256').update(v).digest('hex');
const fail = (message:string, status=400):never => { throw Object.assign(new Error(message), {status}); };
const response = (v:unknown, status=200) => new Response(JSON.stringify(v), {status, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
function text(v:unknown, limit=200, required=false) {
  if (v === undefined && !required) return '';
  if (typeof v !== 'string' || v.length > limit || (required && !v.trim())) fail('Please check the information entered.');
  return (v as string).trim();
}
function validate(v:Data, kind:string) {
  if (!['enquiry','review'].includes(kind)) fail('This form is not available.',404);
  if (v.consent !== true) fail('Please confirm your consent.');
  const fields:Data = {};
  const keys = kind === 'enquiry' ? ['name','email','country','timezone','year','programme','subject','support','contact'] : ['review','relationship'];
  for (const key of keys) fields[key] = text(v[key], ['support','review'].includes(key)?8000:200, true);
  if (kind === 'enquiry') {
    if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(fields.email)) fail('Please enter a valid email address.');
    if (!['Email','Phone'].includes(fields.contact)) fail('Please choose a contact method.');
    const m=/^UTC([+−-])(\d{2}):(00|15|30|45)$/.exec(fields.timezone);
    const offset=fields.timezone==='UTC±00:00'?0:m?(m[1]==='+'?1:-1)*(Number(m[2])+Number(m[3])/60):NaN;
    if (!Number.isFinite(offset)||offset < -12||offset > 14) fail('Please choose a valid UTC offset.');
    for (const key of ['year','programme','subject']) fields['other_'+key]=text(v['other_'+key],200,fields[key]==='Other');
    if (fields.contact==='Phone') {
      const phone=text(v.phone,Infinity), code=text(v.phone_country_code,4);
      if ((phone||code)&&(!phone||!/^\+[1-9][0-9]{0,2}$/.test(code))) fail('Please enter both the country calling code and phone number, or leave both blank.');
      fields.phone=phone?code+' '+phone:'';
    }
  } else fields.public_name=text(v.public_name,200);
  return fields;
}
async function limited(cx:any, key:string, limit:number, duration:number) {
  const now=new Date(), expiresAt=new Date(Date.now()+duration);
  const row=await cx.insertInto('portalRateLimits').values({key,count:1,expiresAt}).onConflict((oc:any)=>oc.column('key').doUpdateSet({count:sql`CASE WHEN portal_rate_limits.expires_at < ${now} THEN 1 ELSE portal_rate_limits.count + 1 END`,expiresAt:sql`CASE WHEN portal_rate_limits.expires_at < ${now} THEN ${expiresAt} ELSE portal_rate_limits.expires_at END`})).returning('count').executeTakeFirst();
  if (row.count>limit) fail('Please wait before sending another submission, or email Amanda directly.',429);
}
async function owner() {
  const a=await db.selectFrom('portalAccounts').select(['id','email']).where('id','=','amanda').where('role','=','admin').where('enabled','=',true).executeTakeFirst();
  if (!a) fail('The form is temporarily unavailable. Please email Amanda directly.',503);
  return a!;
}
export async function publicForms(request:Request) {
  try {
    const url=new URL(request.url), kind=url.searchParams.get('kind')||'';
    const client=hash(request.headers.get('x-auxesis-client')||request.headers.get('x-forwarded-for')||'anonymous');
    if (request.method==='GET') {
      if (!['enquiry','review'].includes(kind)) fail('This form is not available.',404);
      await owner();
      const token=randomBytes(32).toString('base64url'), id='public-'+hash(token);
      await db.transaction().execute(async cx=>{
        await limited(cx,'public-challenge-'+client,30,3600000);
        await limited(cx,'public-challenge-global',300,3600000);
        await cx.deleteFrom('portalRecords').where('kind','=','publicChallenges').where('updatedAt','<',new Date(Date.now()-3600000)).execute();
        await cx.insertInto('portalRecords').values({id,kind:'publicChallenges',data:{kind,client,issued:Date.now(),expires:Date.now()+1800000}}).execute();
      });
      return response({ready:true,mode:'portal',token,notBefore:1500});
    }
    if (request.method!=='POST') fail('Method not allowed.',405);
    if (request.headers.get('origin')!==SITE) fail('Please submit this form from the Auxesis website.',403);
    if (request.headers.get('content-type')?.split(';')[0]!=='application/json') fail('Send JSON data.',415);
    const raw=await request.text(); if (raw.length>24000) fail('Submission is too long.',413);
    let v:Data;try {v=JSON.parse(raw);} catch {fail('Invalid submission.');}
    if (!v!||typeof v!=='object'||Array.isArray(v!)) fail('Invalid submission.');
    if (v!.website) return response({ok:true});
    const fields=validate(v!,kind), token=text(v!.form_token,60,true);
    if (!/^[\w-]{43}$/.test(token)) fail('Please refresh the form and try again.');
    const id='public-'+hash(token), fingerprint=hash(JSON.stringify(fields)), admin=await owner();
    const prior=await db.transaction().execute(async cx=>{
      await sql`select pg_advisory_xact_lock(769463202)`.execute(cx);
      const found=await cx.selectFrom('portalRecords').selectAll().where('id','=',id).executeTakeFirst();
      const d=(found?.data||{}) as Data;
      if (!found||d.kind!==kind||d.client!==client) fail('Please refresh the form and try again.');
      if (found!.kind==='publicSubmissions') {
        if (d.fingerprint!==fingerprint) fail('Please refresh the form before changing the submitted information.');
        if (d.status==='sent') return true;
        fail('The previous attempt needs a fresh form check. Please try again.',409);
      }
      if (Date.now()>d.expires||Date.now()-d.issued<1500) fail('Please refresh the form and try again.');
      await limited(cx,'public-submit-'+client,6,3600000);
      if (fields.email) await limited(cx,'public-email-'+hash(fields.email.toLowerCase()),3,3600000);
      await limited(cx,'public-daily-'+new Date().toISOString().slice(0,10),150,86400000);
      await cx.updateTable('portalRecords').set({kind:'publicSubmissions',data:{kind,client,fingerprint,fields,status:'sending',at:new Date().toISOString()},updatedAt:new Date()}).where('id','=',id).execute();
      return false;
    });
    if (prior) return response({ok:true});
    const title=kind==='enquiry'?'Auxesis Education — tutoring enquiry':'Auxesis Education — review awaiting approval';
    const sent=await sendEmail({from:'Auxesis Education <notifications@auxesis-portal-service.floot.app>',to:admin.email,subject:title,text:Object.entries(fields).map(([k,val])=>k+':\n'+val).join('\n\n')+'\n\nConsent confirmed.\n'+(kind==='review'?'Moderation required. Nothing has been published.':'Submitted through the website.'),...(fields.email?{replyTo:fields.email}:{})});
    await db.updateTable('portalRecords').set({data:{kind,client,fingerprint,fields,status:sent.ok?'sent':'failed',...(sent.ok?{messageId:sent.messageId}:{error:sent.error.code}),at:new Date().toISOString()},updatedAt:new Date()}).where('id','=',id).execute();
    if (!sent.ok) { console.error('Public form delivery failed',sent.error.code); fail('Your submission could not be delivered. Please try again or email Amanda directly.',502); }
    await db.insertInto('portalRecords').values({id:randomUUID(),kind:'notifications',data:{accountId:admin.id,text:kind==='enquiry'?'A new tutoring enquiry was emailed to you.':'A new review was emailed to you for approval.',at:new Date().toISOString()}}).execute();
    return response({ok:true});
  } catch (e:any) {return response({error:e.status?e.message:'The form is temporarily unavailable. Please email Amanda directly.'},e.status||503);}
}
export async function publicFormStatus(request:Request) {
  return portalCore.handle(request,async r=>{
    const a=await portalCore.account(r);if(a.role!=='admin')fail('This record is not available.',403);
    const rows=await db.selectFrom('portalRecords').select('data').where('kind','=','publicSubmissions').orderBy('updatedAt','desc').limit(30).execute();
    const ids=rows.map(x=>(x.data as Data).messageId).filter(Boolean);
    return ids.length?getEmailStatuses(ids):{ok:true,emails:[]};
  });
}
