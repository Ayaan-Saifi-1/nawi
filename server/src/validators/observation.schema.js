import { z } from 'zod';
import { ANNEX_REFS } from '../models/Observation.js';

export function createSingleObservationValidator(ruleConfig) {
  return z.object({
    annexRef: z.enum(ANNEX_REFS, {
      errorMap: () => ({ message: `annexRef must be one of: ${ANNEX_REFS.join(', ')}` }),
    }),
    evaluationMethod: z.enum(['mpe_band', 'manual_checklist', 'structured']),
    referenceLoad: z.number().finite().nonnegative().optional(),
    indicatedValue: z.number().finite().optional(),
    zeroCorrection: z.number().finite().optional(),
    checklistPassed: z.boolean().optional(),
    reviewerNotes: z.string().optional(),
    readings: z.array(
      z.object({
        position: z.any().optional(),
        load: z.number().finite().nonnegative().optional(),
        condition: z.any().optional(),
        indicated: z.number().finite().optional(),
        reference: z.number().finite().nonnegative().optional(),
        zeroCorrection: z.number().finite().optional(),
        deltaL: z.number().finite().optional(),
        timestamp: z.coerce.date().optional(),
      })
    ).optional(),
  }).superRefine((data, ctx) => {
    const criteriaData = ruleConfig?.testCriteria?.find(c => c.annexRef === data.annexRef);
    
    // If criteria exist for this annex, enforce structured
    if (criteriaData) {
      if (data.evaluationMethod !== 'structured') {
         ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${data.annexRef} has test criteria configured and must use 'structured' evaluationMethod`, path: ['evaluationMethod'] });
      }
      const fields = criteriaData.fields || [];
      const readings = data.readings || [];
      if (readings.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${data.annexRef} requires readings`, path: ['readings'] });
      }
      // Check required fields based on criteria
      for (let i = 0; i < readings.length; i++) {
         const r = readings[i];
         for (const f of fields) {
            if (f.required && r[f.name] === undefined) {
               ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Field ${f.name} is required in readings for ${data.annexRef}`, path: ['readings', i, f.name] });
            }
         }
      }
      return; // Skip legacy validation
    }

    // Legacy validation for unconfigured annexes
    if (data.annexRef === 'A4_accuracy' && data.evaluationMethod !== 'mpe_band') {
       ctx.addIssue({ code: z.ZodIssueCode.custom, message: `A4_accuracy requires mpe_band evaluation`, path: ['evaluationMethod'] });
    }
    if (data.annexRef !== 'A4_accuracy' && data.evaluationMethod !== 'manual_checklist') {
       ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${data.annexRef} requires manual_checklist evaluation`, path: ['evaluationMethod'] });
    }

    if (data.evaluationMethod === 'mpe_band') {
      if (data.referenceLoad === undefined || data.referenceLoad === null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'referenceLoad is required for mpe_band evaluation', path: ['referenceLoad'] });
      }
      if (data.indicatedValue === undefined || data.indicatedValue === null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'indicatedValue is required for mpe_band evaluation', path: ['indicatedValue'] });
      }
      if (data.checklistPassed !== undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'checklistPassed should not be provided for mpe_band evaluation', path: ['checklistPassed'] });
      }
    } else if (data.evaluationMethod === 'manual_checklist') {
      if (data.checklistPassed === undefined || data.checklistPassed === null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'checklistPassed is required for manual_checklist evaluation', path: ['checklistPassed'] });
      }
      if (!data.reviewerNotes?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'reviewerNotes is required for manual_checklist evaluation', path: ['reviewerNotes'] });
      }
      if (data.annexRef === 'B_electronic_additional' && (data.reviewerNotes?.trim().length || 0) < 5) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Annex B electronic tests require descriptive reviewer notes detailing test conditions (e.g. voltage, ESD, immunity)', path: ['reviewerNotes'] });
      }
      if (data.referenceLoad !== undefined || data.indicatedValue !== undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'referenceLoad and indicatedValue should not be provided for manual_checklist evaluation', path: ['referenceLoad'] });
      }
    }
  });
}

export function createObservationValidator(ruleConfig) {
  return z.object({
    observations: z.array(createSingleObservationValidator(ruleConfig)).min(1, 'At least one observation required'),
  });
}

// Keep simple loose schemas for route validation if needed, but the controller will do the strict validation
export const addObservationsSchema = z.object({
  observations: z.array(z.any()).min(1),
});

export const updateObservationSchema = z.object({
  annexRef: z.enum(ANNEX_REFS).optional(),
  evaluationMethod: z.enum(['mpe_band', 'manual_checklist', 'structured']).optional(),
  referenceLoad: z.number().finite().nonnegative().optional(),
  indicatedValue: z.number().finite().optional(),
  zeroCorrection: z.number().finite().optional(),
  checklistPassed: z.boolean().optional(),
  reviewerNotes: z.string().optional(),
  readings: z.array(z.any()).optional(),
});
