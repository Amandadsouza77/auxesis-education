import { portalCore } from '../../helpers/portalCore';
import { portalSyncPlan } from '../../helpers/portalSyncPlan';
import { db } from '../../helpers/db';
import { sql } from 'kysely';
import { randomUUID } from 'crypto';
import { publish } from '@floot/realtime';

// Administrator-only import of independently retrieved, complete source snapshots.
// Direct Google preview/apply remains in portal/sync; this path does not grant source access.
export async function handle(request:Request){return portalCore.handle(request,async(r,v)=>{
 portalCore.previewReadOnly(r);const actor=await portalCore.account(r);
 if(actor.role!=='admin')throw Object.assign(new Error('Administrator access is required.'),{status:403});
 const result=await db.transaction().execute(async cx=>{
  await sql`select pg_advisory_xact_lock(769463201)`.execute(cx);
  const rows=await cx.selectFrom('portalRecords').selectAll().execute();
  const all:any[]=rows.map(row=>({...row.data as any,id:row.id,_kind:row.kind}));
  const settings=all.find(row=>row.id==='settings');
  const config={...settings?.syncConfig,series:settings?.syncConfig?.seriesIds};
  if(config.mode!=='pilot')throw Object.assign(new Error('A one-student pilot must be configured.'),{status:409});
  const plan=portalSyncPlan.plan(all,v.snapshot,config);
  if(v.dryRun)return plan.summary;
  const put=async(kind:string,item:any)=>{const data={...item};delete data._kind;await cx.insertInto('portalRecords').values({id:data.id,kind,studentId:kind==='students'?data.id:data.studentId||null,parentId:kind==='parents'?data.id:data.parentId||null,data}).onConflict(oc=>oc.column('id').doUpdateSet({data,revision:sql`portal_records.revision+1`,updatedAt:new Date()})).execute();};
  for(const change of plan.changes)await put(change.kind,change.data);
  await put('settings',{...settings,syncSnapshot:{...plan.summary,checkedAt:new Date().toISOString(),automatic:false}});
  await cx.insertInto('portalAudit').values({id:randomUUID(),accountId:actor.id,action:'sourceSnapshot',recordId:config.studentId}).execute();
  return plan.summary;
 });
 if(!v.dryRun)for(const account of await db.selectFrom('portalAccounts').select('id').where('enabled','=',true).execute())try{await publish('account:'+account.id,{type:'refresh'});}catch{console.error('Snapshot refresh unavailable');}
 return result;
});}
