import {submit,json,deliveryReady} from '../../lib/server.js';
export function onRequestGet({env}){return json({ready:deliveryReady(env)});}
export const onRequestPost=({request,env})=>submit(request,env,'enquiry');
