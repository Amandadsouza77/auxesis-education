import test from 'node:test';
import assert from 'node:assert/strict';
import { withInquiry } from '../cloudflare/inquiry-worker.js';

const site = 'https://auxesis-education.pages.dev';
const env = { SITE_URL: site, EMAIL_FROM: 'Auxesis <forms@example.com>', RESEND_API_KEY: 'test-only',
  TURNSTILE_SECRET_KEY: 'test-only', TURNSTILE_SITE_KEY: 'public-widget-key', ENQUIRY_TO: 'legacy@example.org' };
const data = { name: 'QA parent', email: 'parent@example.net', country: 'Canada', timezone: 'UTC−04:00',
  year: 'Grade 11', programme: 'IB Diploma', subject: 'Biology', support: 'QA inquiry', contact: 'Email',
  consent: true, turnstile_token: 'test-token', to: 'untrusted@example.org' };

test('native worker serves inquiry availability instead of a static 404', async () => {
  const worker = withInquiry({ fetch: () => { throw Error('Inquiry fell through to the old worker'); } });
  for (const suffix of ['', '?delivery=portal&kind=enquiry']) {
    const result = await worker.fetch(new Request(site + '/api/enquiry' + suffix), env);
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('X-Auxesis-Runtime'), 'cloudflare-native');
    assert.equal(result.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await result.json(), { ready: true, siteKey: 'public-widget-key' });
  }
  for (const key of ['SITE_URL', 'EMAIL_FROM', 'RESEND_API_KEY', 'TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY']) {
    const result = await worker.fetch(new Request(site + '/api/enquiry'), { ...env, [key]: '' });
    assert.deepEqual(await result.json(), { ready: false });
  }
});

test('native inquiry sends all details to the requested Gmail address with visitor Reply-To', async t => {
  const messages = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.includes('siteverify')) return Response.json({ success: true, hostname: new URL(site).hostname, action: 'enquiry' });
    assert.equal(url, 'https://api.resend.com/emails');
    messages.push(JSON.parse(options.body));
    return Response.json({ id: 'qa-mock' });
  });
  const worker = withInquiry({ fetch: () => new Response('not found', { status: 404 }) });
  const result = await worker.fetch(new Request(site + '/api/enquiry', { method: 'POST',
    headers: { Origin: site, 'Content-Type': 'application/json' }, body: JSON.stringify(data) }), env);
  assert.deepEqual(await result.json(), { ok: true });
  assert.equal(messages.length, 1);
  assert.deepEqual(messages[0].to, ['adsouza35@gmail.com']);
  assert.equal(messages[0].reply_to, data.email);
  for (const key of ['name', 'email', 'country', 'timezone', 'year', 'programme', 'subject', 'support', 'contact']) {
    assert.ok(messages[0].text.includes(data[key]));
  }
});

test('reviews, portal, assets and scheduled handlers retain the native worker and context', async () => {
  const context = { waitUntil() {} }, bindings = { PORTAL_DB: 'unchanged' };
  const scheduled = () => 'unchanged';
  const native = { scheduled, async fetch(request, receivedEnv, receivedContext) {
    assert.equal(this, native);
    assert.equal(receivedEnv, bindings);
    assert.equal(receivedContext, context);
    return new Response(new URL(request.url).pathname, { headers: { 'X-Existing-Route': 'retained' } });
  } };
  const worker = withInquiry(native);
  assert.equal(worker.scheduled, scheduled);
  for (const path of ['/api/reviews', '/api/reviews/manage', '/api/enquiry?kind=review&delivery=portal', '/api/portal/state', '/', '/app.js']) {
    const result = await worker.fetch(new Request(site + path), bindings, context);
    assert.equal(result.headers.get('X-Existing-Route'), 'retained');
    assert.equal(await result.text(), new URL(site + path).pathname);
  }
  const denied = await worker.fetch(new Request(site + '/api/enquiry', { method: 'DELETE' }), env, context);
  assert.equal(denied.status, 405);
  assert.equal(denied.headers.get('Allow'), 'GET, POST');
});


test('native inquiry accepts the verified custom domain and checks its Turnstile hostname', async t => {
  let messages=0;
  t.mock.method(globalThis,'fetch',async url=>{
    if(url.includes('siteverify'))return Response.json({success:true,hostname:'auxedu.com',action:'enquiry'});
    messages++;return Response.json({id:'mock'});
  });
  const worker=withInquiry({fetch:()=>new Response('other route')});
  const request=()=>new Request('https://auxedu.com/api/enquiry',{method:'POST',headers:{Origin:'https://auxedu.com','Content-Type':'application/json'},body:JSON.stringify(data)});
  assert.equal((await worker.fetch(request(),env)).status,200);assert.equal(messages,1);
  const badOrigin=new Request('https://auxedu.com/api/enquiry',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify(data)});
  assert.equal((await worker.fetch(badOrigin,env)).status,403);assert.equal(messages,1);
  assert.equal((await worker.fetch(request(),{...env,SITE_URL:'https://untrusted.example'})).status,503);assert.equal(messages,1);
});
