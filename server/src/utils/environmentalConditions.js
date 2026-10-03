import { AppError } from './AppError.js';

const NUMERIC_KEYS = ['temperatureC', 'humidityPercent', 'inclinationDeg', 'atmosphericPressurehPa'];

// Merges a partial environmentalConditions update into the stored value.
// Blank/null fields are ignored so required stored values (e.g. notes) can never be wiped by a partial edit.
export function mergeEnvironmentalConditions(current, incoming) {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'environmentalConditions must be an object');
  }
  const merged = { ...(current || {}) };

  for (const key of NUMERIC_KEYS) {
    const value = incoming[key];
    if (value === undefined || value === null || value === '') continue;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new AppError(400, 'VALIDATION_ERROR', `environmentalConditions.${key} must be a finite number`);
    }
    merged[key] = value;
  }
  if (merged.humidityPercent !== undefined && (merged.humidityPercent < 0 || merged.humidityPercent > 100)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'environmentalConditions.humidityPercent must be between 0 and 100');
  }

  if (incoming.notes !== undefined && incoming.notes !== null) {
    if (typeof incoming.notes !== 'string') {
      throw new AppError(400, 'VALIDATION_ERROR', 'environmentalConditions.notes must be text');
    }
    if (incoming.notes.trim()) merged.notes = incoming.notes.trim();
  }
  return merged;
}
