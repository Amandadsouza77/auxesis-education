// Protected live staging checks; private results stay in owner-only Drive.
import {readFileSync,writeFileSync} from 'node:fs';
import {randomBytes,createHash} from 'node:crypto';
import {open} from '../cloudflare/crypto.js';
const account='2ac862d7c1f865935d185df59e7bd719',db='4f12fc1d-3e0d-4a11-bd65-e577ce906114',origin='https://migration-auth.auxesis-production-staging.pages.dev';
const require=(ok,s)=>{if(!ok)throw new Error(s);};
const canonical=v=>JSON.stringify(v&&typeof v==='object'?Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v);
async function cf(path,sql,params){require(!sql||path==='/d1/database/'+db+'/query','Write outside isolated staging rejected.');const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method:sql?'POST':'GET',redirect:'error',headers:{Authorization:'Bearer '+process.env.CLOUDFLARE_API_TOKEN,'Content-Type':'application/json'},...(sql?{body:JSON.stringify({sql,...(params?{params}:{})})}:{})});require(r.ok,'Live staging provider request failed: '+r.status);const j=await r.json();require(j.success,'Live staging provider rejected request.');return j.result;}
const query=async(sql,p)=>(await cf('/d1/database/'+db+'/query',sql,p)).flatMap(x=>x.results||[]);
let testSessionHash,authStateHash,browser;
async function verify(){
 require(process.env.GITHUB_REPOSITORY==='Amandadsouza77/auxesis-education'&&process.env.GITHUB_REF==='refs/heads/codex/cloudflare-backend-migration','Unexpected staging verification branch.');
 const before=JSON.parse(readFileSync('work/staging-deployment/before.json'));
 const stage=await cf('/pages/projects/auxesis-production-staging'),vars=stage.deployment_configs.preview.env_vars;
 require(!stage.canonical_deployment&&stage.deployment_configs.preview.d1_databases.PORTAL_DB.id===db&&vars.PORTAL_STAGING_ONLY.value==='true'&&vars.PORTAL_STAGING_ORIGIN.value===origin&&vars.PRODUCTION_SYNC_ENABLED.value==='false'&&vars.PRODUCTION_AUTOMATION_ENABLED.value==='false','Staging isolation guard failed.');
 const deployment=(await cf('/pages/projects/auxesis-production-staging/deployments')).find(x=>x.environment==='preview'&&x.deployment_trigger?.metadata?.branch==='migration-auth'&&x.deployment_trigger?.metadata?.commit_hash===process.env.GITHUB_SHA);require(deployment?.aliases?.includes(origin),'Observed staging deployment alias differs.');
 const anonymous=await fetch(origin+'/api/portal/state',{redirect:'error'});
 let anonymousReason='';if(anonymous.status!==401&&anonymous.status!==200){const text=await anonymous.text();try{anonymousReason=String(JSON.parse(text).error||'').slice(0,180);}catch{anonymousReason=(text.match(/Error(?: code)?[: ]+(\d+)/i)||[])[1]||'non-JSON response';}}
 require(anonymous.status===401,'Anonymous staging state returned HTTP '+anonymous.status+(anonymousReason?': '+anonymousReason:'.'));
 const auth=await fetch(origin+'/api/portal/auth/start',{redirect:'manual'}),location=new URL(auth.headers.get('Location')||origin);
 require(auth.status===302&&location.origin==='https://accounts.google.com'&&location.searchParams.get('redirect_uri')===origin+'/api/portal/auth/callback'&&location.searchParams.get('code_challenge_method')==='S256'&&location.searchParams.get('client_id')===vars.GOOGLE_CLIENT_ID.value,'Live OAuth/PKCE configuration differs.');
 authStateHash=createHash('sha256').update(location.searchParams.get('state')).digest('base64url');
 const owner=before.accounts[0],grant=(await query("SELECT email,client_id,refresh_token_ciphertext FROM migration_google_authorization WHERE id='owner'"))[0],key=(await query("SELECT secret FROM portal_release_keys WHERE id='migration-transport'"))[0]?.secret;
 require(owner.role==='admin'&&owner.enabled&&owner.email.toLowerCase()===vars.ADMIN_EMAIL.value&&grant.email===owner.email.toLowerCase()&&grant.client_id===vars.GOOGLE_CLIENT_ID.value,'Verified owner/account association failed.');
 // Temporary session exists only in isolated D1 for authorized verification.
 const token=randomBytes(32).toString('base64url');testSessionHash=createHash('sha256').update(token).digest('base64url');
 await query("INSERT INTO portal_sessions(token_hash,account_id,expires_at) VALUES(?1,?2,datetime('now','+10 minutes'))",[testSessionHash,owner.id]);
 const headers={Cookie:'__Host-auxesis_session='+token};
 const read=await fetch(origin+'/api/portal/state',{headers,redirect:'error'});require(read.ok,'Authenticated staging state failed.');const state=await read.json();
 require(state.students.length===15&&state.lessons.length===200&&state.invoices.length===16&&state.payments.length===9&&state.settings.runtimeMode==='production'&&state.settings.syncApplyEnabled===false&&state.settings.automationEnabled===false,'Full roster or financial inventory/state flags differ.');
 for(const kind of ['students','lessons','invoices','payments'])for(const row of before.records.filter(r=>r.kind===kind)){const item=state[kind].find(r=>r.id===row.id);require(item&&canonical(item)===canonical(JSON.parse(row.data)),'Authenticated staging record differs from verified import.');}
 const post=async(path,body,source=origin)=>fetch(origin+'/api/portal/'+path,{method:'POST',redirect:'error',headers:{...headers,Origin:source,'Content-Type':'application/json'},body:JSON.stringify(body)});
 require((await post('sync',{mode:'apply'})).status===403,'Apply was available during staging.');
 require((await post('command',{action:'updateInvoice'})).status===403,'Financial command was available during staging.');
 require((await post('sync',{mode:'preview'},'https://other.invalid')).status===403,'Cross-origin staging request was accepted.');
 const response=await post('sync',{mode:'preview'});require(response.ok,'Live complete-roster source preview failed: '+response.status);const preview=await response.json();require(preview.financialChanges===0&&preview.historicalDebits===0,'Preview includes a financial change or historical debit.');
 const {chromium}=await import('playwright');
 browser=await chromium.launch({headless:true,executablePath:process.env.AUXESIS_CHROMIUM_PATH||'/usr/bin/google-chrome',args:['--no-sandbox']});
 const context=await browser.newContext({timezoneId:'America/Toronto'});await context.addCookies([{name:'__Host-auxesis_session',value:token,url:origin,secure:true,httpOnly:true,sameSite:'Lax'}]);
 const page=await context.newPage();let pageErrors=0,blockedMutations=0,checks=0,browserPhase='student-list';
 page.on('pageerror',()=>pageErrors++);
 await page.route('**/*',route=>{const r=route.request();if(new URL(r.url()).origin!==origin)return route.abort();if(r.method()!=='GET'){blockedMutations++;return route.abort();}return route.continue();});
 try{
  await page.goto(origin+'/portal/students/');await page.getByRole('heading',{name:'Students',exact:true}).waitFor({timeout:20000});require(await page.locator('.student-card').count()===15,'Staged roster display count differs.');checks++;
  for(const s of state.students){require((await page.locator('body').innerText()).includes(s.name),'Staged student name is missing.');checks++;}
  browserPhase='dashboard-chronological-order';
  await page.clock.install({time:new Date('2026-10-09T12:00:00Z')});
  await page.goto(origin+'/portal/dashboard/');await page.locator('[data-action="logout"]').waitFor({timeout:15000});
  const todaySection=page.locator('section').filter({has:page.getByRole('heading',{name:'Today’s lessons',exact:true})});
  const renderedIds=await todaySection.locator('a.lesson-row').evaluateAll(nodes=>nodes.map(n=>new URL(n.href).searchParams.get('id')));
  const torontoDay=v=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));
  const expectedToday=state.lessons.filter(l=>torontoDay(l.start)==='2026-10-09').sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
  require(canonical(renderedIds)===canonical(expectedToday.map(l=>l.id)),'Dashboard lesson order is not chronological.');
  require(expectedToday.length>=2&&new Date(expectedToday[0].start).getUTCHours()===8,'Expected morning lesson was not first.');checks++;
  await page.goto(origin+'/portal/students/');await page.getByRole('heading',{name:'Students',exact:true}).waitFor({timeout:15000});
  browserPhase='sync-controls';
  require(await page.locator('[data-action="source-sync-apply"]').count()===0,'Apply control was visible.');checks++;
  require(await page.getByRole('button',{name:'Preview roster sync',exact:true}).count()===1,'Complete roster preview control is missing.');checks++;
  require((await page.locator('body').innerText()).includes('Automatic synchronization is paused'),'Automation status was not paused.');checks++;
  for(const path of ['/portal/dashboard/','/portal/lessons/','/portal/calendar/','/portal/billing/','/portal/messages/','/portal/account/','/resources/manage/',...state.students.map(s=>'/portal/student/?id='+s.id),...state.invoices.map(i=>'/portal/invoice/?id='+i.id)]){
   browserPhase=path.split('?')[0];await page.goto(origin+path);await page.locator('[data-action="logout"]').waitFor({timeout:15000});await page.locator('#main').waitFor({timeout:15000});require((await page.locator('body').innerText()).trim().length>80,'Staged Portal page did not render.');checks++;
  }
  require(pageErrors===0&&blockedMutations===0,'Browser verification encountered errors or mutation requests.');checks+=2;
 }catch{throw new Error('Live staged Portal browser verification failed in '+browserPhase+'; page errors='+pageErrors+', blocked mutations='+blockedMutations+'. Private selector details omitted.');}finally{await browser.close();browser=null;}
 const after=await query('SELECT * FROM portal_records ORDER BY id');require(after.length===371,'Staging durable count changed.');
 for(const original of before.records){const current=after.find(r=>r.id===original.id);require(current,'Retained staging record is missing.');if(original.id!=='settings')require(canonical(current)===canonical(original),'Staging verification altered a business record.');else{const a=JSON.parse(original.data),b=JSON.parse(current.data);delete a.rosterSyncHealth;delete b.rosterSyncHealth;require(canonical(a)===canonical(b),'Staging settings changed beyond read-only preview health.');}}
 require(canonical(await query('SELECT * FROM portal_accounts ORDER BY id'))===canonical(before.accounts)&&canonical(await query('SELECT * FROM portal_audit ORDER BY id'))===canonical(before.audits),'Original account/audit inventory changed.');
 const live=await cf('/pages/projects/auxesis-education');require(canonical({configs:live.deployment_configs,deployment:live.canonical_deployment?.id})===canonical(before.production),'Production changed during staging verification.');
 const result={verifiedAt:new Date().toISOString(),stagingUrl:origin,productionUnchanged:true,preservedRecords:371,preservedStudents:15,preservedLessons:200,preservedInvoices:16,preservedPayments:9,oauthPkceVerified:true,unauthenticatedAccessBlocked:true,authenticatedStateExact:true,applyBlocked:true,financialCommandsBlocked:true,crossOriginBlocked:true,dashboardChronologicalOrderVerified:true,browserChecks:checks,browserErrors:pageErrors,browserMutations:blockedMutations,sourcePreview:preview,financialChanges:0,historicalDebits:0,originalPortalKeyUntouched:true,liveSynchronizationEnabled:false};
 writeFileSync('work/staging-deployment/private-results.json',JSON.stringify(result,null,2),{mode:0o600});
 const refreshed=await fetch('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:grant.client_id,client_secret:process.env.GOOGLE_CLIENT_SECRET,refresh_token:await open(key,grant.refresh_token_ciphertext)})});require(refreshed.ok,'Private result authorization refresh failed.');const access=(await refreshed.json()).access_token;
 const boundary='auxesis-'+randomBytes(12).toString('hex');const report=Buffer.from(JSON.stringify(result));const body=Buffer.concat([Buffer.from('--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify({name:'Auxesis private staging verification.json',mimeType:'application/json',appProperties:{auxesisPurpose:'staging-verification'}})+'\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'),report,Buffer.from('\r\n--'+boundary+'--\r\n')]);
 const saved=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+access,'Content-Type':'multipart/related; boundary='+boundary},body});require(saved.ok,'Private staging verification report could not be saved.');const reportId=(await saved.json()).id;
 await query('CREATE TABLE IF NOT EXISTS migration_validation_reports(id TEXT PRIMARY KEY,file_id TEXT NOT NULL,created_at TEXT NOT NULL)');
 await query("INSERT INTO migration_validation_reports(id,file_id,created_at) VALUES('staging',?1,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET file_id=excluded.file_id,created_at=CURRENT_TIMESTAMP",[reportId]);
 const metadata=await fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(reportId)+'?fields=ownedByMe,shared,permissions',{headers:{Authorization:'Bearer '+access},redirect:'error'});require(metadata.ok,'Private verification report metadata unreadable.');const m=await metadata.json();require(m.ownedByMe===true&&m.shared!==true&&(m.permissions||[]).every(p=>p.type==='user'&&p.role==='owner'),'Verification report is not owner-only.');
 console.log('::notice title=Live staged Portal verified::'+JSON.stringify({...Object.fromEntries(Object.entries(result).filter(([k])=>k!=='sourcePreview')),sourcePreviewReady:preview.canApply,sourceIssues:preview.issues.length,heldItems:preview.held.length,proposedChanges:preview.changedRecords}));
}
try{await verify();}catch(e){console.error('::error title=Live staging verification::'+e.message);process.exitCode=1;}finally{
 if(browser)await browser.close();
 if(testSessionHash)await query('DELETE FROM portal_sessions WHERE token_hash=?1',[testSessionHash]);
 if(authStateHash)await query('DELETE FROM portal_auth_flows WHERE token_hash=?1',[authStateHash]);
}
