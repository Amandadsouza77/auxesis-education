import { z } from 'zod';
export const schema=z.record(z.any());
export type Output={ok?:boolean;error?:string};
