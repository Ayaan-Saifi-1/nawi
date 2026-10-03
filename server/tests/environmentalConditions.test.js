import { mergeEnvironmentalConditions } from '../src/utils/environmentalConditions.js';

describe('mergeEnvironmentalConditions', () => {
  const current = { temperatureC: 20, humidityPercent: 50, inclinationDeg: 0.1, atmosphericPressurehPa: 1013, notes: 'Lab A' };

  it('keeps stored notes when a partial edit omits them', () => {
    const merged = mergeEnvironmentalConditions(current, { temperatureC: 22, humidityPercent: 55, inclinationDeg: '' });
    expect(merged).toEqual({ ...current, temperatureC: 22, humidityPercent: 55 });
  });

  it('ignores blank or null values instead of wiping stored ones', () => {
    expect(mergeEnvironmentalConditions(current, { temperatureC: null, notes: '   ' })).toEqual(current);
  });

  it('rejects invalid values with a 400 error', () => {
    expect(() => mergeEnvironmentalConditions(current, { humidityPercent: 120 })).toThrow(/between 0 and 100/);
    expect(() => mergeEnvironmentalConditions(current, { temperatureC: 'hot' })).toThrow(/finite number/);
    expect(() => mergeEnvironmentalConditions(current, 'x')).toThrow(/must be an object/);
  });
});
