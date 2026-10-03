const WEIGHT_MULTIPLIERS = [1, 2, 5];
const MAX_BLOCK_DENOMINATIONS = 12;

function cleanWeight(value) {
  return Number(value.toPrecision(12));
}

export function createWeightDenominations(maxCapacity, scaleInterval) {
  const capacity = Number(maxCapacity);
  const interval = Number(scaleInterval);
  if (!Number.isFinite(capacity) || capacity <= 0 || !Number.isFinite(interval) || interval <= 0) {
    return [];
  }

  const candidates = new Set();
  for (let power = 0; power <= 12; power += 1) {
    for (const multiplier of WEIGHT_MULTIPLIERS) {
      const weight = cleanWeight(interval * multiplier * (10 ** power));
      if (weight <= capacity) candidates.add(weight);
    }
  }

  const sorted = [...candidates].sort((a, b) => a - b);
  if (sorted.length <= MAX_BLOCK_DENOMINATIONS) return sorted;

  return Array.from({ length: MAX_BLOCK_DENOMINATIONS }, (_, index) => {
    const candidateIndex = Math.round((index * (sorted.length - 1)) / (MAX_BLOCK_DENOMINATIONS - 1));
    return sorted[candidateIndex];
  }).filter((weight, index, values) => values.indexOf(weight) === index);
}

export function sumWeightBlocks(blockCounts) {
  return cleanWeight(Object.entries(blockCounts).reduce(
    (total, [weight, count]) => total + Number(weight) * count,
    0,
  ));
}
