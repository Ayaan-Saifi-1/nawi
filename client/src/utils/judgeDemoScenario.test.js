import { describe, expect, it } from 'vitest';
import { buildJudgeDemoSessionForm } from './judgeDemoScenario.js';

describe('buildJudgeDemoSessionForm', () => {
  it('prefills the required fields with registered selections and clearly marked demo values', () => {
    const form = buildJudgeDemoSessionForm(
      { _id: 'model-1' },
      { labId: 'LAB-1' },
      new Date('2026-09-30T10:11:12.345Z')
    );

    expect(form).toMatchObject({
      instrumentModelId: 'model-1',
      serialNumber: 'DEMO-SN-20260930101112345',
      labId: 'LAB-1',
      testDate: '2026-09-30',
      temperatureC: '22.5',
      humidityPercent: '55',
      inclinationDeg: '0',
      verificationStage: 'initial',
      selectedAnnexes: [
        'A1_administrative',
        'A4_accuracy',
        'A4_eccentricity',
        'A4_repeatability',
        'A4_discrimination',
        'A2_construction',
      ],
    });
    expect(form.envNotes).toContain('Judge demo sample values');
  });

  it('supports alternate registered model and laboratory identifiers', () => {
    const form = buildJudgeDemoSessionForm(
      { id: 'model-2' },
      { _id: 'lab-2' },
      new Date('2026-09-30T10:11:12.345Z')
    );

    expect(form.instrumentModelId).toBe('model-2');
    expect(form.labId).toBe('lab-2');
  });
});
