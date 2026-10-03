import { z } from 'zod';

const CLASS_BOUNDS = {
  I: { nMin: 50000, nMax: null },
  II: { nMin: 100, nMax: 100000 },
  III: { nMin: 100, nMax: 10000 },
  IIII: { nMin: 100, nMax: 1000 },
};

export const createInstrumentModelSchema = z
  .object({
    manufacturerId: z.string().min(1, 'manufacturerId is required'),
    modelName: z.string().min(1, 'modelName is required'),
    accuracyClass: z.enum(['I', 'II', 'III', 'IIII'], {
      errorMap: () => ({ message: 'accuracyClass must be one of I, II, III, IIII' }),
    }),
    maxCapacity: z.number().positive('maxCapacity must be > 0'),
    e: z.number().positive('e must be > 0'),
    minCapacity: z.number().nonnegative('minCapacity must be >= 0'),
  })
  .superRefine((data, ctx) => {
    const n = data.maxCapacity / data.e;
    if (Math.abs(n - Math.round(n)) > 1e-9) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Max capacity must be an integer multiple of verification interval e', path: ['maxCapacity'] });
    }
    const bounds = CLASS_BOUNDS[data.accuracyClass];
    if (!bounds) return;

    if (n < bounds.nMin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `INVALID_CLASS_PARAMETERS: Computed n (${n}) is less than minimum allowed (${bounds.nMin}) for Class ${data.accuracyClass}`,
        path: ['maxCapacity'],
      });
    }

    if (bounds.nMax !== null && n > bounds.nMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `INVALID_CLASS_PARAMETERS: Computed n (${n}) is greater than maximum allowed (${bounds.nMax}) for Class ${data.accuracyClass}`,
        path: ['maxCapacity'],
      });
    }
  });
