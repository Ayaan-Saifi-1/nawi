import { describe, expect, it } from 'vitest';
import { buildJudgeDemoObservation } from './judgeDemoObservation.js';

describe('buildJudgeDemoObservation', () => {
  it('fills MPE accuracy values based on instrument capacity and interval', () => {
    expect(buildJudgeDemoObservation({
      annexRef: 'A4_accuracy',
      evaluationMethod: 'mpe_band',
      maxCapacity: 1500,
      minCapacity: 10,
      scaleInterval: 0.5,
    })).toEqual({
      annexRef: 'A4_accuracy',
      evaluationMethod: 'mpe_band',
      referenceLoad: '750',
      indicatedValue: '750',
      zeroCorrection: '0',
    });
  });

  it('creates the minimum number of complete structured sample readings', () => {
    expect(buildJudgeDemoObservation({
      annexRef: 'A4_repeatability',
      evaluationMethod: 'structured',
      fields: [
        { name: 'load', type: 'number', required: true },
        { name: 'indicated', type: 'number', required: true },
      ],
      minimumRows: 2,
      maxCapacity: 30,
      minCapacity: 1,
      scaleInterval: 0.5,
    })).toEqual({
      annexRef: 'A4_repeatability',
      evaluationMethod: 'structured',
      readings: [{ load: 15, indicated: 15 }, { load: 15, indicated: 15 }],
    });
  });

  it('marks manual checklist notes as judge-demo-only', () => {
    const observation = buildJudgeDemoObservation({
      annexRef: 'A1_administrative',
      evaluationMethod: 'manual_checklist',
    });

    expect(observation.checklistPassed).toBe(true);
    expect(observation.reviewerNotes).toContain('Judge demo sample only');
  });

  it('fills rule-configured manual criteria with checklist data and a structured reading row', () => {
    expect(buildJudgeDemoObservation({
      annexRef: 'A1_administrative',
      evaluationMethod: 'structured',
      criterionType: 'manual',
      fields: [],
      minimumRows: 1,
    })).toMatchObject({
      annexRef: 'A1_administrative',
      evaluationMethod: 'structured',
      readings: [{}],
      checklistPassed: true,
      reviewerNotes: expect.stringContaining('Judge demo sample only'),
    });
  });
});
