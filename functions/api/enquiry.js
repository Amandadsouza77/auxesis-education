import {submit,json,deliveryReady} from '../../lib/server.js';
import {publicForm} from '../../lib/public-forms.js';
// The destination is controlled here, never by visitor input or the portal.
const enquiryEnv=env=>({...env,ENQUIRY_TO:'adsouza35@gmail.com'});
export function onRequestGet({request,env}){
  const params=request&&new URL(request.url).searchParams;
  if(params?.get('delivery')==='portal'&&params.get('kind')==='review')return publicForm(request,'review');
  if(params?.get('kind')==='review')return json({ready:deliveryReady(env)});
  const ready=deliveryReady(enquiryEnv(env))&&!!env.TURNSTILE_SITE_KEY;
  return json({ready,...(ready?{siteKey:env.TURNSTILE_SITE_KEY}:{})});
}
export const onRequestPost=({request,env})=>submit(request,enquiryEnv(env),'enquiry');
