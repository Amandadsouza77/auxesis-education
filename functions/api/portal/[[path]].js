import {handlePortalRequest} from '../../../cloudflare/runtime.js';

// Cloudflare-native portal boundary for the migration preview. This route must
// not proxy to Floot: identity, persistence and source access terminate here.
export const onRequest = handlePortalRequest;
