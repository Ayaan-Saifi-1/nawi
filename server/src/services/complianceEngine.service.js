import { AppError } from '../utils/AppError.js';

const DECIMAL_SCALE = 1_000_000_000n;
const DECIMAL_SCALE_NUMBER = Number(DECIMAL_SCALE);

function toScaledInteger(value, label) {
  const scaled = value * DECIMAL_SCALE_NUMBER;
  if (!Number.isSafeInteger(Math.round(scaled)) || Math.abs(scaled - Math.round(scaled)) > 1e-6) {
    throw new AppError(422, 'VALUE_PRECISION_EXCEEDED', `${label} exceeds the supported range or nine decimal places`);
  }
  return BigInt(Math.round(scaled));
}

export function getBandMpeScaled(referenceLoadScaled, eScaled, ruleConfig, verificationStage) {
  const sortedBands = ruleConfig.bands.slice().sort((a, b) => a.uptoMultipleOfE - b.uptoMultipleOfE);
  const band = sortedBands.find((b) => b.uptoMultipleOfE == null || referenceLoadScaled <= BigInt(b.uptoMultipleOfE) * eScaled);
  if (!band) throw new AppError(422, 'LOAD_OUT_OF_RANGE', 'Reference load exceeds all defined bands for this rule configuration');
  const multValue = verificationStage === 'subsequent' ? (ruleConfig.subsequentMpeMultiplier ?? 2.0) : 1.0;
  const stageMultiplier = toScaledInteger(multValue, 'subsequent MPE multiplier');
  return (toScaledInteger(band.mpeFactor, 'MPE factor') * stageMultiplier) / DECIMAL_SCALE;
}

export function evaluateAnnex(annexRef, observation, instrumentModel, ruleConfig, verificationStage = 'initial') {
  const criteriaData = ruleConfig.testCriteria?.find(c => c.annexRef === annexRef);
  if (!criteriaData || !criteriaData.criterion) {
    throw new AppError(400, 'NO_CRITERIA', `No test criteria defined for annex ${annexRef}`);
  }

  const { criterion } = criteriaData;
  const { type, params } = criterion;
  const readings = observation.readings || [];

  if (type !== 'manual' && readings.length === 0) {
    throw new AppError(400, 'NO_READINGS', 'Observations require readings for structured test evaluation');
  }

  if (!Number.isFinite(instrumentModel.e) || instrumentModel.e <= 0 ||
      !Number.isFinite(instrumentModel.maxCapacity) || instrumentModel.maxCapacity <= 0) {
    throw new AppError(422, 'INVALID_INSTRUMENT_PARAMETERS', 'Instrument capacity and verification interval must be positive');
  }

  const eScaled = toScaledInteger(instrumentModel.e, 'verification interval');
  let computedErrors = [];
  let worstMargin = Infinity;
  let maxRange = 0;
  let isPass = true;
  let maxErrorRatioE = 0;

  if (type === 'manual') {
    // A manual criterion is never auto-passed: it needs an explicit positive confirmation.
    return { outcome: observation.checklistPassed === true ? 'pass' : 'fail', ruleConfigId: ruleConfig._id };
  }

  if (type === 'max_abs_error_le_mpe_factor') {
    let evaluated = 0;
    for (const r of readings) {
      if (r.reference == null || r.indicated == null) continue;
      evaluated += 1;
      const refScaled = toScaledInteger(r.reference, 'reference');
      const indScaled = toScaledInteger(r.indicated, 'indicated');
      
      const zeroCorrectionScaled = r.zeroCorrection == null
        ? 0n
        : toScaledInteger(r.zeroCorrection, 'zeroCorrection');
      let errorScaled = indScaled - refScaled - zeroCorrectionScaled;
      if (ruleConfig.useRoundingCorrection && r.deltaL != null) {
         const deltaLScaled = toScaledInteger(r.deltaL, 'deltaL');
         const halfEScaled = eScaled / 2n;
         errorScaled = (indScaled + halfEScaled - deltaLScaled) - refScaled - zeroCorrectionScaled;
      }

      const factorScaled = getBandMpeScaled(refScaled, eScaled, ruleConfig, verificationStage);
      const factorParam = params?.factor || 1.0;
      const appliedTargetMpeScaled = (factorScaled * eScaled * toScaledInteger(factorParam, 'factor')) / DECIMAL_SCALE;
      const targetMpe = Number(appliedTargetMpeScaled) / (DECIMAL_SCALE_NUMBER * DECIMAL_SCALE_NUMBER);

      const absErrorScaled = errorScaled < 0n ? -errorScaled : errorScaled;
      const computedError = Number(errorScaled) / DECIMAL_SCALE_NUMBER;
      const margin = targetMpe - Math.abs(computedError);
      
      const eValue = Number(eScaled) / DECIMAL_SCALE_NUMBER;
      const currentRatioE = eValue !== 0 ? computedError / eValue : 0;
      if (Math.abs(currentRatioE) > Math.abs(maxErrorRatioE)) {
        maxErrorRatioE = currentRatioE;
      }

      if (margin < worstMargin) worstMargin = margin;
      computedErrors.push({ load: r.reference, error: computedError, mpe: targetMpe, margin });
      
      if (absErrorScaled * DECIMAL_SCALE > appliedTargetMpeScaled) {
        isPass = false;
      }
    }
    if (evaluated === 0) {
      throw new AppError(422, 'NO_EVALUABLE_READINGS', `No complete reference/indicated reading pairs to evaluate for ${annexRef}`);
    }
    if (worstMargin === Infinity) worstMargin = null;
    return { outcome: isPass ? 'pass' : 'fail', computedErrors, worstMargin, errorRatioE: maxErrorRatioE, ruleConfigId: ruleConfig._id };
  }
  
  if (type === 'range_le_mpe_factor') {
    const loadGroups = {};
    let evaluatedGroups = 0;
    for (const r of readings) {
      const l = r.load ?? r.reference;
      if (l == null || r.indicated == null) continue;
      if (!loadGroups[l]) loadGroups[l] = [];
      const indicatedScaled = toScaledInteger(r.indicated, 'indicated');
      const loadScaled = toScaledInteger(l, 'load');
      const zeroCorrectionScaled = r.zeroCorrection == null
        ? 0n
        : toScaledInteger(r.zeroCorrection, 'zeroCorrection');
      const errorScaled = indicatedScaled - loadScaled - zeroCorrectionScaled;
      const bandFactorScaled = getBandMpeScaled(loadScaled, eScaled, ruleConfig, verificationStage);
      const factorParam = params?.factor || 1.0;
      const appliedTargetMpeScaled = (bandFactorScaled * eScaled * toScaledInteger(factorParam, 'factor')) / DECIMAL_SCALE;
      const targetMpe = Number(appliedTargetMpeScaled) / (DECIMAL_SCALE_NUMBER * DECIMAL_SCALE_NUMBER);
      const errorValue = Number(errorScaled) / DECIMAL_SCALE_NUMBER;
      const errorMargin = targetMpe - Math.abs(errorValue);
      const errorPass = errorMargin >= 0;
      if (!errorPass) isPass = false;
      if (worstMargin === Infinity || errorMargin < worstMargin) worstMargin = errorMargin;
      computedErrors.push({
        load: Number(l),
        error: errorValue,
        mpe: targetMpe,
        margin: errorMargin,
        result: errorPass ? 'pass' : 'fail',
        comparison: 'individual_error',
      });
      loadGroups[l].push(indicatedScaled);
    }
    for (const [lStr, inds] of Object.entries(loadGroups)) {
      if (inds.length < 2) continue;
      evaluatedGroups += 1;
      const load = Number(lStr);
      const minInd = inds.reduce((a, b) => a < b ? a : b);
      const maxInd = inds.reduce((a, b) => a > b ? a : b);
      const rangeScaled = maxInd - minInd;
      const rangeValue = Number(rangeScaled) / DECIMAL_SCALE_NUMBER;
      if (rangeValue > maxRange) maxRange = rangeValue;

      const lScaled = toScaledInteger(load, 'load');
      const factorScaled = getBandMpeScaled(lScaled, eScaled, ruleConfig, verificationStage);
      const factorParam = params?.factor || 1.0;
      const appliedTargetMpeScaled = (factorScaled * eScaled * toScaledInteger(factorParam, 'factor')) / DECIMAL_SCALE;
      const targetMpe = Number(appliedTargetMpeScaled) / (DECIMAL_SCALE_NUMBER * DECIMAL_SCALE_NUMBER);
      const rangeMarginScaled = appliedTargetMpeScaled - rangeScaled * DECIMAL_SCALE;
      const rangeMargin = Number(rangeMarginScaled) / (DECIMAL_SCALE_NUMBER * DECIMAL_SCALE_NUMBER);
      const rangePass = rangeMargin >= 0;
      if (!rangePass) isPass = false;
      if (worstMargin === Infinity || rangeMargin < worstMargin) worstMargin = rangeMargin;
      computedErrors.push({
        load,
        error: rangeValue,
        mpe: targetMpe,
        margin: rangeMargin,
        result: rangePass ? 'pass' : 'fail',
        comparison: 'repeatability_range',
      });
    }
    if (evaluatedGroups === 0) {
      throw new AppError(422, 'NO_EVALUABLE_READINGS', `Repeatability for ${annexRef} needs at least two readings at the same load`);
    }
    return {
      outcome: isPass ? 'pass' : 'fail',
      range: maxRange,
      computedErrors,
      worstMargin: worstMargin === Infinity ? null : worstMargin,
      ruleConfigId: ruleConfig._id,
    };
  }

  if (type === 'change_le_factor_of_e') {
    const factorParam = params?.factor || 1.0;
    const targetScaled = (eScaled * toScaledInteger(factorParam, 'factor')) / DECIMAL_SCALE;
    
    let minInd = null;
    let maxInd = null;
    let indicatedCount = 0;
    for (const r of readings) {
      if (r.indicated == null) continue;
      indicatedCount += 1;
      const ind = toScaledInteger(r.indicated, 'indicated');
      if (minInd === null || ind < minInd) minInd = ind;
      if (maxInd === null || ind > maxInd) maxInd = ind;
    }
    // A change needs at least two indications; a single reading would give a change of 0 and pass vacuously.
    if (indicatedCount < 2) {
      throw new AppError(422, 'NO_EVALUABLE_READINGS', `${annexRef} needs at least two indicated values to evaluate a change`);
    }
    const changeScaled = maxInd - minInd;
    if (changeScaled > targetScaled) isPass = false;
    return { outcome: isPass ? 'pass' : 'fail', range: Number(changeScaled) / DECIMAL_SCALE_NUMBER, ruleConfigId: ruleConfig._id };
  }

  throw new AppError(422, 'UNSUPPORTED_CRITERION', `Unsupported test criterion type ${type}`);
}

export function evaluateObservation(observation, instrumentModel, ruleConfig, verificationStage = 'initial') {
  if (observation.evaluationMethod === 'structured') {
    return evaluateAnnex(observation.annexRef, observation, instrumentModel, ruleConfig, verificationStage);
  }

  if (observation.evaluationMethod === 'manual_checklist') {
    const outcome = observation.checklistPassed ? 'pass' : 'fail';
    return { outcome, ruleConfigId: ruleConfig._id };
  }

  const annexRef = observation.annexRef || 'A4_accuracy';
  if (annexRef !== 'A4_accuracy') {
    throw new AppError(422, 'UNSUPPORTED_TEST_METHOD', 'Automatic MPE calculation is currently implemented only for A4 accuracy observations');
  }

  if (
    observation.referenceLoad === undefined ||
    observation.referenceLoad === null ||
    observation.indicatedValue === undefined ||
    observation.indicatedValue === null
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'referenceLoad and indicatedValue are required for mpe_band evaluation'
    );
  }

  if (!Number.isFinite(observation.referenceLoad) || !Number.isFinite(observation.indicatedValue)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Observation values must be finite numbers');
  }
  if (observation.zeroCorrection != null && !Number.isFinite(observation.zeroCorrection)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'zeroCorrection must be a finite number');
  }
  if (!Number.isFinite(instrumentModel.e) || instrumentModel.e <= 0 ||
      !Number.isFinite(instrumentModel.maxCapacity) || instrumentModel.maxCapacity <= 0) {
    throw new AppError(422, 'INVALID_INSTRUMENT_PARAMETERS', 'Instrument capacity and verification interval must be positive');
  }
  const referenceLoadScaled = toScaledInteger(observation.referenceLoad, 'referenceLoad');
  const indicatedValueScaled = toScaledInteger(observation.indicatedValue, 'indicatedValue');
  const eScaled = toScaledInteger(instrumentModel.e, 'verification interval');
  const maxCapacityScaled = toScaledInteger(instrumentModel.maxCapacity, 'maximum capacity');
  if (referenceLoadScaled > maxCapacityScaled) {
    throw new AppError(422, 'LOAD_OUT_OF_RANGE', 'Reference load exceeds the instrument maximum capacity');
  }

  const zeroCorrectionScaled = toScaledInteger(observation.zeroCorrection || 0, 'zeroCorrection');

  const factorScaled = getBandMpeScaled(referenceLoadScaled, eScaled, ruleConfig, verificationStage);
  const errorScaled = indicatedValueScaled - referenceLoadScaled - zeroCorrectionScaled;
  const withinMpe = (errorScaled < 0n ? -errorScaled : errorScaled) * DECIMAL_SCALE <= factorScaled * eScaled;
  const appliedMpe = Number(factorScaled * eScaled) / (DECIMAL_SCALE_NUMBER * DECIMAL_SCALE_NUMBER);
  const computedError = Number(errorScaled) / DECIMAL_SCALE_NUMBER;
  const outcome = withinMpe ? 'pass' : 'fail';

  const marginToMpe = appliedMpe - Math.abs(computedError);
  const eValue = Number(eScaled) / DECIMAL_SCALE_NUMBER;
  const errorRatioE = eValue !== 0 ? computedError / eValue : null;

  return {
    computedError,
    appliedMpe,
    marginToMpe,
    errorRatioE,
    outcome,
    ruleConfigId: ruleConfig._id,
  };
}

export function evaluateSession(observations) {
  if (!observations || observations.length === 0) {
    throw new AppError(
      422,
      'NO_OBSERVATIONS',
      'Cannot evaluate a session with zero observations'
    );
  }

  return observations.every((o) => o.outcome === 'pass') ? 'pass' : 'fail';
}
