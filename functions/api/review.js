import {submit} from '../../lib/server.js';
import {publicForm} from '../../lib/public-forms.js';
export const onRequestPost=({request,env})=>new URL(request.url).searchParams.get('delivery')==='portal'?publicForm(request,'review'):submit(request,env,'review');
