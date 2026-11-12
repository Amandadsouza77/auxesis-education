import { deliveryReady, json, submit } from '../lib/server.js';

// Keep the recipient under server control, independent of portal accounts and input.
const enquiryEnv = (env, request) => {
  const allowed = ['https://auxesis-education.pages.dev', 'https://auxedu.com'];
  const incoming = new URL(request.url).origin;
  // Permit only the two owner-controlled inquiry origins. Other native routes
  // retain their original environment and origin checks.
  const configured = (env.SITE_URL || '').replace(/\/$/, '');
  return { ...env, ENQUIRY_TO: 'adsouza35@gmail.com',
    SITE_URL: allowed.includes(configured) && allowed.includes(incoming) ? incoming : '' };
};

export function withInquiry(nativeWorker) {
  return {
    ...nativeWorker,
    async fetch(request, env, context) {
      const url = new URL(request.url);
      // Native reviews have their own handler and moderation system.
      if (url.pathname !== '/api/enquiry' || url.searchParams.get('kind') === 'review') {
        return nativeWorker.fetch(request, env, context);
      }
      let response;
      if (request.method === 'GET') {
        const ready = deliveryReady(enquiryEnv(env, request)) && !!env.TURNSTILE_SITE_KEY;
        response = json({ ready, ...(ready ? { siteKey: env.TURNSTILE_SITE_KEY } : {}) });
      } else if (request.method === 'POST') {
        response = await submit(request, enquiryEnv(env, request), 'enquiry');
      } else {
        response = json({ error: 'Method not allowed.' }, 405);
        response.headers.set('Allow', 'GET, POST');
      }
      response.headers.set('X-Auxesis-Runtime', 'cloudflare-native');
      return response;
    },
  };
}
