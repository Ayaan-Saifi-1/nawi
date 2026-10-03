export function buildJudgeDemoObservation({
  annexRef,
  evaluationMethod,
  criterionType,
  fields = [],
  minimumRows = 1,
  maxCapacity,
  minCapacity = 0,
  scaleInterval,
  bands = [],
}) {
  if (evaluationMethod === 'structured') {
    if (criterionType === 'manual') {
      return {
        annexRef,
        evaluationMethod,
        readings: [{}],
        checklistPassed: true,
        reviewerNotes: 'Judge demo sample only; replace with actual inspection evidence.',
      };
    }

    const load = getDemoLoad(maxCapacity, minCapacity, scaleInterval, bands);
    const readings = Array.from({ length: minimumRows }, () => {
      const reading = {};
      fields.forEach((field) => {
        if (field.type === 'boolean') {
          reading[field.name] = true;
        } else if (field.type === 'string') {
          reading[field.name] = demoStringValue(field.name);
        } else {
          reading[field.name] = demoNumberValue(field.name, load);
        }
      });
      return reading;
    });

    return { annexRef, evaluationMethod, readings };
  }

  if (evaluationMethod === 'manual_checklist') {
    return {
      annexRef,
      evaluationMethod,
      checklistPassed: true,
      reviewerNotes: 'Judge demo sample only; replace with actual inspection evidence.',
    };
  }

  const referenceLoad = getDemoLoad(maxCapacity, minCapacity, scaleInterval, bands);
  return {
    annexRef,
    evaluationMethod: 'mpe_band',
    referenceLoad: String(referenceLoad),
    indicatedValue: String(referenceLoad),
    zeroCorrection: '0',
  };
}

function getDemoLoad(maxCapacity, minCapacity, scaleInterval, bands = []) {
  const max = Number(maxCapacity);
  const min = Number(minCapacity);
  const interval = Number(scaleInterval);
  let upperLimit = Number.isFinite(max) && max > 0 ? max : 1000;

  if (Array.isArray(bands) && bands.length > 0 && Number.isFinite(interval) && interval > 0) {
    const finiteBands = bands.filter((b) => Number.isFinite(Number(b.uptoMultipleOfE)));
    if (finiteBands.length > 0) {
      const maxBandMultiple = Math.max(...finiteBands.map((b) => Number(b.uptoMultipleOfE)));
      const maxBandLoad = maxBandMultiple * interval;
      upperLimit = Math.min(upperLimit, maxBandLoad);
    }
  }

  const midpoint = upperLimit / 2;
  const lowerBound = Number.isFinite(min) && min >= 0 ? min : 0;
  const rawLoad = Math.min(upperLimit, Math.max(lowerBound, midpoint));

  if (!Number.isFinite(interval) || interval <= 0) return rawLoad;
  return Math.min(upperLimit, Math.max(lowerBound, Math.round(rawLoad / interval) * interval));
}

function demoStringValue(fieldName) {
  const name = fieldName.toLowerCase();
  if (name.includes('position')) return 'Center (demo)';
  if (name.includes('condition')) return 'Stable test condition (demo)';
  return 'Demo sample';
}

function demoNumberValue(fieldName, load) {
  const name = fieldName.toLowerCase();
  if (name.includes('load') || name === 'reference' || name === 'indicated') return load;
  return 0;
}
