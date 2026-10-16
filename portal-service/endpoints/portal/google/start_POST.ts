import { portalCore } from '../../../helpers/portalCore';
import { googleConnect } from '../../../helpers/googleConnect';
export async function handle(request:Request){return portalCore.handle(request,async r=>{portalCore.previewReadOnly(r);return googleConnect.start(await portalCore.account(r));});}
