import { googleConnect } from '../../helpers/googleConnect';
import { renderConnectionPopup } from '@floot/google-integrations';
export async function handle(request:Request){try{return await googleConnect.callback(request);}catch{return renderConnectionPopup({type:'GOOGLE_INTEGRATION_ERROR',error:'Connection could not be completed. Start again from the portal.'});}}
