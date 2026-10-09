import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handle} from '../scripts/staging-authorization/worker.js';
import {open} from '../scripts/staging-authorization/crypto.js';
const origin='https://migration-auth.auxesis-production-staging.pages.dev';
function fixture(t){
 const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../scripts/staging-authorization/schema.sql',import.meta.url),'utf8'));sql.exec("CREATE TABLE portal_release_keys(id TEXT PRIMARY KEY,secret TEXT);INSERT INTO portal_release_keys VALUES('migration-transport','existing-private-transport-fixture');CREATE TABLE portal_records(id TEXT PRIMARY KEY,data TEXT);INSERT INTO portal_records VALUES('unchanged','{\"amount\":320}');");
 const db={prepare(q){const stmt={bind(...p){return {first:async()=>sql.prepare(q).get(...p),run:async()=>sql.prepare(q).run(...p)};},first:async()=>sql.prepare(q).get(),run:async()=>sql.prepare(q).run()};return stmt;}};
 const env={PORTAL_DB:db,PORTAL_DB_ID:'4f12fc1d-3e0d-4a11-bd65-e577ce906114',PRODUCTION_SYNC_ENABLED:'false',PRODUCTION_AUTOMATION_ENABLED:'false',GOOGLE_CLIENT_ID:'existing-client',GOOGLE_CLIENT_SECRET:'existing-secret',ADMIN_EMAIL:'owner@example.invalid'};
 let email='owner@example.invalid',verified=true,reads=0;const old=global.fetch;
 global.fetch=async url=>{reads++;return {ok:true,json:async()=>url.includes('/token')?{access_token:'private-access',refresh_token:'private-refresh',scope:'openid email https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar.readonly'}:{email,email_verified:verified}};};
 t.after(()=>{global.fetch=old;sql.close();});
 const start=async()=>{const r=await handle(new Request(origin+'/authorize'),env);return {url:new URL(r.headers.get('Location')),cookie:r.headers.get('Set-Cookie').split(';')[0]};};
 const callback=async(s,c=s.cookie)=>handle(new Request(origin+'/api/portal/auth/callback?code=fixture-code&state='+s.url.searchParams.get('state'),{headers:{Cookie:c}}),env);
 return {sql,env,start,callback,setIdentity:(e,v=true)=>{email=e;verified=v;},reads:()=>reads};
}
test('consent stores a separate encrypted owner grant without reading original Portal key or changing business data',async t=>{
 const f=fixture(t),s=await f.start();assert.equal(s.url.searchParams.get('code_challenge_method'),'S256');assert.equal(s.url.searchParams.get('redirect_uri'),origin+'/api/portal/auth/callback');assert((await f.callback(s)).ok);
 const grant=f.sql.prepare('SELECT * FROM migration_google_authorization').get();assert.equal(grant.email,'owner@example.invalid');assert(!grant.refresh_token_ciphertext.includes('private-refresh'));assert.equal(await open('existing-private-transport-fixture',grant.refresh_token_ciphertext),'private-refresh');assert.equal(f.sql.prepare('SELECT data FROM portal_records').get().data,'{"amount":320}');assert.equal((await f.callback(s)).status,401);
});
test('cookie-bound state prevents cross-browser callback and preserves token for correct browser',async t=>{const f=fixture(t),s=await f.start();assert.equal((await f.callback(s,'')).status,401);assert.equal(f.reads(),0);assert((await f.callback(s)).ok);});
test('unassigned or unverified Google identity cannot store authorization',async t=>{const f=fixture(t);f.setIdentity('other@example.invalid');assert.equal((await f.callback(await f.start())).status,403);f.setIdentity('owner@example.invalid',false);assert.equal((await f.callback(await f.start())).status,403);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM migration_google_authorization').get().n,0);});
test('production origin, wrong database, live sync and non-GET requests are blocked',async t=>{const f=fixture(t);assert.equal((await handle(new Request('https://auxesis-education.pages.dev/authorize'),f.env)).status,503);assert.equal((await handle(new Request(origin+'/authorize'),{...f.env,PORTAL_DB_ID:'wrong'})).status,503);assert.equal((await handle(new Request(origin+'/authorize'),{...f.env,PRODUCTION_SYNC_ENABLED:'true'})).status,503);assert.equal((await handle(new Request(origin+'/authorize',{method:'POST'}),f.env)).status,405);assert.equal(f.reads(),0);});
test('expired authorization cannot be exchanged',async t=>{const f=fixture(t),s=await f.start();f.sql.exec("UPDATE migration_oauth_flows SET expires_at='2000-01-01'");assert.equal((await f.callback(s)).status,401);assert.equal(f.reads(),0);});
