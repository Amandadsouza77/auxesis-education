import { z } from 'zod';
export const schema=z.object({mode:z.enum(['preview','apply']),digest:z.string().regex(/^[a-f0-9]{64}$/).optional()});
