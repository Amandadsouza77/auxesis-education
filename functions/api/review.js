import {submit} from '../../lib/server.js';
export const onRequestPost=({request,env})=>submit(request,env,'review');
