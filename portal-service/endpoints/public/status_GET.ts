import { publicFormStatus } from '../../helpers/publicForms';
export async function handle(request:Request){return publicFormStatus(request);}
