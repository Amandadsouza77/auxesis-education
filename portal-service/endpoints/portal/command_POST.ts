import { portalCore } from '../../helpers/portalCore';
export async function handle(request:Request){return portalCore.handle(request,async(r,v)=>portalCore.command(r,v));}
