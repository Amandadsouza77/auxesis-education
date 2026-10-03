import { z } from 'zod';
export const schema=z.record(z.any());
export type Input=z.infer<typeof schema>;
export type Output=any;
