import { z } from 'zod';
export const schema=z.object({kind:z.enum(['enquiry','review'])});
export type Output={ready:boolean;mode:string;token:string;notBefore:number};
