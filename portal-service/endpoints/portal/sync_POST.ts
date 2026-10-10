import { portalCore } from '../../helpers/portalCore';
import { portalSync } from '../../helpers/portalSync';
export async function handle(request:Request){return portalCore.handle(request,async(r,v)=>{portalCore.previewReadOnly(r);return portalSync(await portalCore.account(r),v);});}
