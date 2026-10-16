import { googleConnect } from '../../helpers/googleConnect';
export async function handle(request:Request){try{return await googleConnect.authorize(request);}catch(e:any){return new Response(JSON.stringify({error:e.status?e.message:'Google connection could not start.'}),{status:e.status||503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}}
