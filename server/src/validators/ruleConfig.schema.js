import { z } from 'zod';
import { ANNEX_REFS } from '../models/Observation.js';

export const createRuleConfigSchema = z
  .object({
    oimlEdition: z.string().min(1, 'oimlEdition is required'),
    accuracyClass: z.enum(['I', 'II', 'III', 'IIII']),
    effectiveDate: z.string().or(z.date()).transform((val) => new Date(val)),
    bands: z
      .array(
        z.object({
          uptoMultipleOfE: z.number().finite().int().positive().max(Number.MAX_SAFE_INTEGER),
          mpeFactor: z.number().finite().positive(),
        })
      )
      .min(1, 'At least one band must be defined'),
    subsequentMpeMultiplier: z.number().finite().positive().optional(),
    useRoundingCorrection: z.boolean().optional(),
    testCriteria: z.array(
      z.object({
        annexRef: z.enum(ANNEX_REFS),
        fields: z.array(
          z.object({
            name: z.string().min(1),
            labelEn: z.string().min(1),
            labelHi: z.string().optional(),
            type: z.enum(['number', 'boolean', 'string']),
            unit: z.string().optional(),
            min: z.number().optional(),
            max: z.number().optional(),
            required: z.boolean().optional()
          })
        ).optional(),
        criterion: z.object({
          type: z.enum(['max_abs_error_le_mpe_factor', 'range_le_mpe_factor', 'change_le_factor_of_e', 'manual']),
          params: z.object({
            factor: z.number().finite().positive().optional()
          }).passthrough().optional()
        }).optional()
      })
    ).optional(),
  })
  .superRefine((data, ctx) => {
    for (let i = 1; i < data.bands.length; i++) {
      if (data.bands[i].uptoMultipleOfE <= data.bands[i - 1].uptoMultipleOfE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Band upper limit at index ${i} must be strictly greater than index ${i - 1}`,
          path: ['bands', i, 'uptoMultipleOfE'],
        });
      }
    }

    if (data.testCriteria && data.testCriteria.length > 0) {
      const annexRefs = new Set();
      data.testCriteria.forEach((tc, tcIndex) => {
        if (annexRefs.has(tc.annexRef)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate annexRef '${tc.annexRef}' in testCriteria`,
            path: ['testCriteria', tcIndex, 'annexRef'],
          });
        }
        annexRefs.add(tc.annexRef);

        if (tc.fields && tc.fields.length > 0) {
          const fieldNames = new Set();
          tc.fields.forEach((f, fIndex) => {
            if (fieldNames.has(f.name)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Duplicate field name '${f.name}' in testCriteria[${tcIndex}]`,
                path: ['testCriteria', tcIndex, 'fields', fIndex, 'name'],
              });
            }
            fieldNames.add(f.name);
          });
        }

        if (tc.criterion && tc.criterion.type === 'max_abs_error_le_mpe_factor') {
          if (!tc.fields || !tc.fields.some((f) => f.name === 'reference')) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Criterion ${tc.criterion.type} for ${tc.annexRef} requires a 'reference' field`,
              path: ['testCriteria', tcIndex, 'criterion'],
            });
          }
        }
      });
    }
  });

export const activateRuleConfigSchema = z.object({
  sourceReference: z.string().trim().min(1),
  validationNote: z.string().trim().min(1),
});
