import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isRegionalTimeZone,currentOffset,legacyOffset} from '../lib/time-zones.js';
import {withPublicSite} from '../cloudflare/public-site-worker.js';
test('regional selections follow northern and southern hemisphere DST, fractional offsets and no-DST regions',()=>{
 const winter=new Date('2026-01-15T12:00:00Z'),summer=new Date('2026-07-15T12:00:00Z');
 for(const [zone,jan,jul] of [['America/Vancouver','UTC-08:00','UTC-07:00'],['America/Toronto','UTC-05:00','UTC-04:00'],['Australia/Adelaide','UTC+10:30','UTC+09:30'],['Asia/Kathmandu','UTC+05:45','UTC+05:45'],['America/Phoenix','UTC-07:00','UTC-07:00']]){assert(isRegionalTimeZone(zone));assert.equal(currentOffset(zone,winter),jan);assert.equal(currentOffset(zone,summer),jul);}
 for(const invalid of ['Eastern Time','Europe/Imaginary','UTC+05:00','GMT -4','<script>'])assert(!isRegionalTimeZone(invalid));
 assert(legacyOffset('UTC−05:00'));assert(legacyOffset('GMT +5.5'));assert(!legacyOffset('GMT +15'));
});
test('canonical redirects cover public GET/HEAD only, retain query strings and never intercept private routes or API posts',async()=>{
 const wrapped=withPublicSite({fetch:r=>new Response('retained:'+new URL(r.url).pathname,{status:202})});
 for(const method of ['GET','HEAD']){const r=await wrapped.fetch(new Request('https://auxesis-education.pages.dev/enquire/?subject=Biology',{method}));assert.equal(r.status,301);assert.equal(r.headers.get('location'),'https://auxedu.com/enquire/?subject=Biology');}
 for(const path of ['/portal/','/api/enquiry','/api/portal/state','/api/auth/callback','/resources/','/admin/'])assert.equal((await wrapped.fetch(new Request('https://auxesis-education.pages.dev'+path))).status,202);
 assert.equal((await wrapped.fetch(new Request('https://auxesis-education.pages.dev/enquire/',{method:'POST'}))).status,202);
 assert.equal((await wrapped.fetch(new Request('https://auxedu.com/enquire/'))).status,202);
});
