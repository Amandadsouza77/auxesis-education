import {submit,json,deliveryReady} from '../../lib/server.js';
import {publicForm} from '../../lib/public-forms.js';
export function onRequestGet({request,env}){return request&&new URL(request.url).searchParams.get('delivery')==='portal'?publicForm(request,new URL(request.url).searchParams.get('kind')||'enquiry'):json({ready:deliveryReady(env)});}
export const onRequestPost=({request,env})=>new URL(request.url).searchParams.get('delivery')==='portal'?publicForm(request,'enquiry'):submit(request,env,'enquiry');
