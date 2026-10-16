import { z } from 'zod';
export const schema=z.object({snapshot:z.record(z.unknown()),dryRun:z.boolean().optional()});
export type OutputType=Record<string,unknown>;
