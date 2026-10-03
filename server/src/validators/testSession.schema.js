import { z } from 'zod';
import { ANNEX_REFS } from '../models/Observation.js';

export const createTestSessionSchema = z
  .object({
    instrumentModelId: z.string().min(1, 'instrumentModelId is required'),
    serialNumber: z.string().trim().min(1, 'serialNumber is required'),
    selectedAnnexes: z.array(z.enum(ANNEX_REFS)).min(1, 'Select at least one test procedure'),
    testDate: z.string().date('testDate must be a valid calendar date').transform((val) => new Date(`${val}T00:00:00.000Z`)),
    verificationStage: z.enum(['initial', 'subsequent']).default('initial').optional(),
    labId: z.string().trim().min(1).optional(),
    clientLocation: z.object({
      latitude: z.number().finite(),
      longitude: z.number().finite(),
      accuracyM: z.number().finite().nonnegative(),
      capturedAt: z.string().datetime(),
    }).optional(),
    environmentalConditions: z
      .object({
        temperatureC: z.number().finite(),
        humidityPercent: z.number().finite().min(0).max(100),
        inclinationDeg: z.number().finite(),
        atmosphericPressurehPa: z.number().optional(),
        notes: z.string().trim().min(1),
      }),
  })
  .superRefine((data, ctx) => {
    if (data.testDate && data.testDate > new Date(Date.now() + 86400000)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'testDate cannot be in the future',
        path: ['testDate'],
      });
    }
  });
