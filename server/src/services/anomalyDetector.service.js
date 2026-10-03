import { Observation } from '../models/Observation.js';
import { TestSession } from '../models/TestSession.js';

function median(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function detectObservationAnomalies(observation, session) {
  let isApplicable = false;
  let currentValue = null;

  if (observation.evaluationMethod === 'mpe_band' && observation.errorRatioE !== null && observation.errorRatioE !== undefined) {
    isApplicable = true;
    currentValue = observation.errorRatioE;
  } else if (observation.evaluationMethod === 'structured') {
    if (observation.annexRef === 'A4_accuracy' && observation.errorRatioE !== undefined && observation.errorRatioE !== null) {
      isApplicable = true;
      currentValue = observation.errorRatioE;
    } else if (observation.annexRef === 'A4_eccentricity' && observation.worstMargin !== undefined && observation.worstMargin !== null) {
      isApplicable = true;
      currentValue = observation.worstMargin; // Note: higher is better, but distribution anomaly can still be checked
    } else if (observation.annexRef === 'A4_repeatability' && observation.range !== undefined && observation.range !== null) {
      isApplicable = true;
      currentValue = observation.range;
    }
  }

  if (!isApplicable) return observation;

  const historicalSessions = await TestSession.find({
    instrumentModelId: session.instrumentModelId,
    _id: { $ne: session._id },
    status: { $in: ['under_review', 'passed', 'failed'] },
  }).select('_id');

  if (!historicalSessions.length) return observation;
  const sessionIds = historicalSessions.map((s) => s._id);

  // Find prior observations for the same model, same annex
  const priorObs = await Observation.find({
    testSessionId: { $in: sessionIds },
    deletedAt: null,
    annexRef: observation.annexRef,
  });

  const values = [];
  for (const o of priorObs) {
    if (o.evaluationMethod === 'mpe_band' && o.errorRatioE !== null && o.errorRatioE !== undefined) {
      values.push(o.errorRatioE);
    } else if (o.evaluationMethod === 'structured') {
      if (o.annexRef === 'A4_accuracy' && o.errorRatioE !== undefined && o.errorRatioE !== null) {
        values.push(o.errorRatioE);
      } else if (o.annexRef === 'A4_eccentricity' && o.worstMargin !== undefined && o.worstMargin !== null) {
        values.push(o.worstMargin);
      } else if (o.annexRef === 'A4_repeatability' && o.range !== undefined && o.range !== null) {
        values.push(o.range);
      }
    }
  }

  if (values.length < 10) return observation;

  const med = median(values);
  const absDeviations = values.map((v) => Math.abs(v - med));
  const mad = median(absDeviations);

  const x = currentValue;
  let zScore = 0;
  if (mad > 0) {
    zScore = (0.6745 * (x - med)) / mad;
  } else if (x !== med) {
    zScore = 99.0;
  }

  if (Math.abs(zScore) > 3.5) {
    let metricName = 'Error ratio';
    let flagType = 'ANOMALY_ERROR_RATIO';
    if (observation.evaluationMethod === 'structured') {
      if (observation.annexRef === 'A4_eccentricity') {
        metricName = 'Worst margin';
        flagType = 'ANOMALY_METRIC_DEVIATION';
      } else if (observation.annexRef === 'A4_repeatability') {
        metricName = 'Range';
        flagType = 'ANOMALY_METRIC_DEVIATION';
      }
    }

    observation.advisoryFlags = [
      {
        flagType: flagType,
        zScore: Number(zScore.toFixed(2)),
        message: `${metricName} (${x.toFixed(3)}) deviates significantly from model median (${med.toFixed(3)}), Z=${zScore.toFixed(2)}`,
        acknowledged: false,
      },
    ];
  }

  return observation;
}
