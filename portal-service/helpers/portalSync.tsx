import { db } from './db';
import { sql } from 'kysely';
import { createHash, randomUUID } from 'crypto';
import { getGoogleAccessToken } from '@floot/google-integrations';
import { publish } from '@floot/realtime';
import { syncPlan } from './syncPlan';
import { readSyncSources } from './readSyncSources';
type Item=Record<string,any>;
const digest=(v:any)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const error=(message:string,status=409)=>Object.assign(new Error(message),{status});
const put=async(cx:any,kind:string,data:Item)=>{const clean={...data};delete clean._kind;await cx.insertInto('portalRecords').values({id:clean.id,kind,studentId:kind==='students'?clean.id:clean.studentId||null,parentId:kind==='parents'?clean.id:clean.parentId||null,data:clean}).onConflict((oc:any)=>oc.column('id').doUpdateSet({data:clean,revision:sql`portal_records.revision+1`,updatedAt:new Date()})).execute();};
export async function portalSync(actor:Item,request:Item) {
  if(actor.role!=='admin')throw error('Administrator access is required.',403);
  if(!['preview','apply'].includes(request.mode))throw error('Choose preview or apply.',400);
  if(request.mode==='apply'&&!/^[a-f0-9]{64}$/.test(request.digest||''))throw error('Preview the pilot changes first.',400);
  const settings=(await db.selectFrom('portalRecords').select('data').where('id','=','settings').executeTakeFirst())?.data as Item;
  const config=settings?.syncConfig;
  if(!config?.studentId||config.mode!=='pilot')throw error('One-student pilot is not configured.');
  const attemptedAt=new Date().toISOString();
  try {
    const input=await readSyncSources(config,async url=>{
      let token;try{token=await getGoogleAccessToken(db,config.googleEmail);}catch{throw error('Connect the portal to Google Calendar and select the Student Tracker before syncing.',503);}
      const response=await fetch(url,{headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(30000)});
      if(!response.ok)throw error(response.status===403||response.status===404?'Google access is incomplete. Reconnect Calendar and grant access to the selected Student Tracker.':'Google source read failed. Existing records were retained.',503);
      return response.json();
    });
    const result=await db.transaction().execute(async cx=>{
      await sql`select pg_advisory_xact_lock(769463201)`.execute(cx);
      const rows=await cx.selectFrom('portalRecords').selectAll().execute();
      const all:Item[]=rows.map(r=>({...r.data as Item,id:r.id,_kind:r.kind}));
      const latest=all.find(r=>r.id==='settings') as Item;
      if(digest(latest.syncConfig)!==digest(config))throw error('Sync configuration changed. Preview again.');
      const plan=syncPlan(all,input,config);
      // Bind approval to source contents and current records, not a mutable browser payload.
      const fingerprint=digest({config,students:input.students,lessons:input.lessons,billing:input.billing,events:input.events,records:rows.filter(r=>r.studentId===config.studentId||r.id===all.find(r=>r.id===config.studentId)?.parentId).map(r=>({id:r.id,revision:r.revision})).sort((a,b)=>a.id.localeCompare(b.id))});
      const summary={studentName:plan.studentName,studentId:plan.studentId,changedRecords:plan.changes.length,eventCount:plan.eventCount,trackerLessonCount:plan.trackerLessonCount,billingRowCount:plan.billingRowCount,issues:plan.issues,canApply:plan.canApply,digest:fingerprint};
      if(request.mode==='apply'){
        if(fingerprint!==request.digest)throw error('Sources or portal records changed. Preview again.');
        if(!plan.canApply)throw error('Resolve the listed source conflicts before applying this pilot.');
        for(const change of plan.changes)await put(cx,change.kind,change.data);
        await cx.insertInto('portalAudit').values({id:randomUUID(),accountId:actor.id,action:'sourceSync',recordId:config.studentId}).execute();
      }
      latest.syncHealth={...latest.syncHealth,lastAttemptedAt:attemptedAt,lastReadAt:new Date().toISOString(),lastSuccessfulAt:request.mode==='apply'?new Date().toISOString():latest.syncHealth?.lastSuccessfulAt||null,state:request.mode==='apply'?'applied':plan.canApply?'preview-ready':'conflicts',summary,error:null};
      await put(cx,'settings',latest);
      return {ok:true,mode:request.mode,...summary};
    });
    if(request.mode==='apply'){
      const accounts=await db.selectFrom('portalAccounts').select('id').where('enabled','=',true).execute();
      for(const a of accounts)try{await publish('account:'+a.id,{type:'refresh'});}catch{console.error('Sync live refresh failed; reopen the portal.');}
    }
    return result;
  }catch(e:any){
    await db.transaction().execute(async cx=>{await sql`select pg_advisory_xact_lock(769463201)`.execute(cx);const row=await cx.selectFrom('portalRecords').select('data').where('id','=','settings').executeTakeFirst();const latest=row?.data as Item;if(latest){latest.syncHealth={...latest.syncHealth,lastAttemptedAt:attemptedAt,state:'error',error:e.status?e.message:'Sync could not complete. Existing records were retained.'};await put(cx,'settings',{...latest,id:'settings'});}});
    throw e.status?e:error('Sync could not complete. Existing records were retained.',503);
  }
}
