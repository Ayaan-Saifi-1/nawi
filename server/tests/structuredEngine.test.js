import { jest } from '@jest/globals';
import { evaluateAnnex } from '../src/services/complianceEngine.service.js';
import { detectObservationAnomalies } from '../src/services/anomalyDetector.service.js';
import { TestSession } from '../src/models/TestSession.js';
import { Observation } from '../src/models/Observation.js';

describe('Structured Engine DB-free Tests', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('emits errorRatioE as the signed error of the worst reading divided by e', () => {
    const ruleConfig = {
      _id: 'rule123',
      subsequentMpeMultiplier: 2.0,
      bands: [{ uptoMultipleOfE: 1000, mpeFactor: 1.0 }],
      testCriteria: [{
        annexRef: 'A4_accuracy',
        criterion: { type: 'max_abs_error_le_mpe_factor', params: { factor: 1.0 } }
      }]
    };

    const instrumentModel = { e: 0.1, maxCapacity: 100 };
    
    const observation = {
      readings: [
        { reference: 10, indicated: 10.02 }, // error: 0.02, ratio = +0.2
        { reference: 20, indicated: 19.95 }, // error: -0.05, ratio = -0.5
        { reference: 30, indicated: 30.01 }  // error: +0.01, ratio = +0.1
      ]
    };

    const result = evaluateAnnex('A4_accuracy', observation, instrumentModel, ruleConfig);
    expect(result.errorRatioE).toBeCloseTo(-0.5); // largest |error| is -0.05, ratio is -0.5
  });

  it('emits ANOMALY_ERROR_RATIO only for errorRatioE deviations', async () => {
    jest.spyOn(TestSession, 'find').mockReturnValue({
      select: jest.fn().mockResolvedValue([{ _id: 'session1' }])
    });

    const priorObs = Array(10).fill({
      evaluationMethod: 'structured',
      annexRef: 'A4_accuracy',
      errorRatioE: 0.1
    });

    jest.spyOn(Observation, 'find').mockResolvedValue(priorObs);

    const observation = {
      annexRef: 'A4_accuracy',
      evaluationMethod: 'structured',
      errorRatioE: 0.8,
      outcome: 'pass'
    };

    const session = { _id: 'session2', instrumentModelId: 'model1' };

    const detected = await detectObservationAnomalies(observation, session);
    
    expect(detected.advisoryFlags).toBeDefined();
    expect(detected.advisoryFlags.length).toBe(1);
    expect(detected.advisoryFlags[0].flagType).toBe('ANOMALY_ERROR_RATIO');
    expect(observation.outcome).toBe('pass'); // Ensure advisory flag never changes outcome
  });

  it('emits ANOMALY_METRIC_DEVIATION for other structured metrics', async () => {
    jest.spyOn(TestSession, 'find').mockReturnValue({
      select: jest.fn().mockResolvedValue([{ _id: 'session1' }])
    });

    const priorObs = Array(10).fill({
      evaluationMethod: 'structured',
      annexRef: 'A4_eccentricity',
      worstMargin: 0.5
    });

    jest.spyOn(Observation, 'find').mockResolvedValue(priorObs);

    const observation = {
      annexRef: 'A4_eccentricity',
      evaluationMethod: 'structured',
      worstMargin: 1.5,
      outcome: 'fail'
    };

    const session = { _id: 'session2', instrumentModelId: 'model1' };

    const detected = await detectObservationAnomalies(observation, session);
    
    expect(detected.advisoryFlags).toBeDefined();
    expect(detected.advisoryFlags.length).toBe(1);
    expect(detected.advisoryFlags[0].flagType).toBe('ANOMALY_METRIC_DEVIATION');
    expect(observation.outcome).toBe('fail'); // Ensure advisory flag never changes outcome
  });
});
