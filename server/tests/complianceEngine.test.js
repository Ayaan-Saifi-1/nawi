import { evaluateObservation, evaluateSession } from '../src/services/complianceEngine.service.js';

describe('Compliance Engine Service', () => {
  // A class III fixture with n = Max / e = 500 verification intervals.
  const instrument = {
    accuracyClass: 'III',
    maxCapacity: 250,
    e: 0.5,
    minCapacity: 10,
    n: 500,
  };

  const ruleConfig = {
    _id: 'rule_class_3_2006',
    oimlEdition: 'R76-1:2006',
    accuracyClass: 'III',
    effectiveDate: new Date('2006-01-01'),
    bands: [
      { uptoMultipleOfE: 500, mpeFactor: 0.5 },
      { uptoMultipleOfE: 2000, mpeFactor: 1.0 },
      { uptoMultipleOfE: 10000, mpeFactor: 1.5 },
    ],
  };

  test('pass within lowest band', () => {
    // For n=500, MPE is 0.5e = 0.25kg.
    const result = evaluateObservation(
      { evaluationMethod: 'mpe_band', referenceLoad: 200, indicatedValue: 200.15 },
      instrument,
      ruleConfig
    );
    expect(result.outcome).toBe('pass');
    expect(result.computedError).toBeCloseTo(0.15);
    expect(result.appliedMpe).toBe(0.25);
  });

  test('fail above highest band', () => {
    const largerInstrument = { ...instrument, maxCapacity: 5000, n: 10000 };
    const result = evaluateObservation(
      { evaluationMethod: 'mpe_band', referenceLoad: 1400, indicatedValue: 1401.20 },
      largerInstrument,
      ruleConfig
    );
    expect(result.outcome).toBe('fail');
    expect(result.computedError).toBeCloseTo(1.20);
    expect(result.appliedMpe).toBe(0.75);
  });

  test('exact boundary is inclusive on lower band', () => {
    // At n=500, the inclusive band applies 0.5e.
    // indicated = 250.25 -> error = 0.25 -> pass
    const resultInclusivePass = evaluateObservation(
      { evaluationMethod: 'mpe_band', referenceLoad: 250, indicatedValue: 250.25 },
      instrument,
      ruleConfig
    );
    expect(resultInclusivePass.outcome).toBe('pass');
    expect(resultInclusivePass.appliedMpe).toBe(0.25);

    // indicated = 250.30 -> error = 0.30 (> 0.25) -> fail.
    const resultInclusiveFail = evaluateObservation(
      { evaluationMethod: 'mpe_band', referenceLoad: 250, indicatedValue: 250.30 },
      instrument,
      ruleConfig
    );
    expect(resultInclusiveFail.outcome).toBe('fail');
    expect(resultInclusiveFail.appliedMpe).toBe(0.25);
  });

  test('uses n-based band above the inclusive class boundary', () => {
    const n501Instrument = { ...instrument, maxCapacity: 250.5, n: 501 };
    const result = evaluateObservation(
      { evaluationMethod: 'mpe_band', referenceLoad: 250.5, indicatedValue: 250.9 },
      n501Instrument,
      ruleConfig
    );
    expect(result.appliedMpe).toBe(0.5);
  });

  test('session fails if any single observation fails, even if others pass', () => {
    expect(
      evaluateSession([{ outcome: 'pass' }, { outcome: 'pass' }, { outcome: 'fail' }])
    ).toBe('fail');
  });

  test('session passes if all observations pass', () => {
    expect(
      evaluateSession([{ outcome: 'pass' }, { outcome: 'pass' }, { outcome: 'pass' }])
    ).toBe('pass');
  });

  test('manual checklist observation pass/fail outcome', () => {
    const passCheck = evaluateObservation(
      { evaluationMethod: 'manual_checklist', checklistPassed: true },
      instrument,
      ruleConfig
    );
    expect(passCheck.outcome).toBe('pass');

    const failCheck = evaluateObservation(
      { evaluationMethod: 'manual_checklist', checklistPassed: false },
      instrument,
      ruleConfig
    );
    expect(failCheck.outcome).toBe('fail');
  });
});
