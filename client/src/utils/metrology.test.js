import { describe, expect, it } from 'vitest';
import { buildReadingPayload, formatMetrologyValue, getDisplayReadingFields, getMandatoryProcedureAnnexes, getMissingSelectedProcedures, getRuleFieldLabel, getSubmissionFocusAnnex, hasRequiredReadings, minimumReadingCount } from './metrology.js';

describe('metrology helpers', () => {
  it('formats values with six decimal places, trimmed zeros, and signs', () => {
    expect(formatMetrologyValue(1.2, true)).toBe('+1.2');
    expect(formatMetrologyValue(-0.5, true)).toBe('-0.5');
    expect(formatMetrologyValue(null)).toBe('-');
  });

  it('requires two rows for repeatability and discrimination criteria', () => {
    expect(minimumReadingCount({ criterion: { type: 'range_le_mpe_factor' } })).toBe(2);
    expect(minimumReadingCount({ criterion: { type: 'change_ge_factor_of_e' } })).toBe(2);
    expect(minimumReadingCount({ criterion: { type: 'change_le_factor_of_e' } })).toBe(2);
    expect(hasRequiredReadings([{ load: 1 }], [{ name: 'load', required: true }], 2)).toBe(false);
  });

  it('omits empty optional fields from reading payloads', () => {
    expect(buildReadingPayload([{ load: '1', note: '' }], [{ name: 'load', type: 'number', required: true }, { name: 'note', type: 'string' }])).toEqual([{ load: 1 }]);
  });

  it('identifies selected procedures without observations in selection order', () => {
    expect(getMissingSelectedProcedures(
      ['A1_administrative', 'A2_construction', 'A4_accuracy'],
      [{ annexRef: 'A1_administrative' }, { annexRef: 'A4_accuracy' }],
    )).toEqual(['A2_construction']);
    expect(getMissingSelectedProcedures(
      ['A2_construction'],
      [{ annexRef: 'A2_construction' }],
    )).toEqual([]);
  });

  it('finds approved active mandatory tests for the session class and stage', () => {
    const testTypes = [
      { oimlAnnexRef: 'A4_accuracy', status: 'approved', isActive: true, mandatoryFor: [{ accuracyClass: 'III', verificationStage: 'all' }] },
      { oimlAnnexRef: 'A4_eccentricity', status: 'approved', isActive: true, mandatoryFor: [{ accuracyClass: 'III', verificationStage: 'initial' }] },
      { oimlAnnexRef: 'A5_temperature', status: 'approved', isActive: true, mandatoryFor: [{ accuracyClass: 'III', verificationStage: 'subsequent' }] },
      { oimlAnnexRef: 'A4_repeatability', status: 'draft', isActive: true, mandatoryFor: [{ accuracyClass: 'III', verificationStage: 'all' }] },
      { oimlAnnexRef: 'A4_discrimination', status: 'approved', isActive: false, mandatoryFor: [{ accuracyClass: 'III', verificationStage: 'all' }] },
      { oimlAnnexRef: 'A4_accuracy', status: 'approved', isActive: true, mandatoryFor: [{ accuracyClass: 'II', verificationStage: 'all' }] },
    ];

    expect(getMandatoryProcedureAnnexes(testTypes, 'III', 'initial')).toEqual([
      'A4_accuracy',
      'A4_eccentricity',
    ]);
  });

  it('shows only known measurement fields when rule metadata is missing', () => {
    expect(getDisplayReadingFields([], [{ _id: 'row-1', __v: 0 }])).toEqual([]);
    expect(getDisplayReadingFields([], [{ _id: 'row-1', reference: 5, indicated: 5.1 }])).toEqual([
      { name: 'reference', labelEn: 'Reference load' },
      { name: 'indicated', labelEn: 'Indicated value' },
    ]);
  });

  it('maps failed submission messages to the affected procedure', () => {
    const testTypes = [
      { testName: 'Repeatability', oimlAnnexRef: 'A4_repeatability' },
      { testName: 'Eccentricity', oimlAnnexRef: 'A4_eccentricity' },
    ];
    expect(getSubmissionFocusAnnex(
      'Missing mandatory test types: Eccentricity, Repeatability',
      testTypes,
    )).toBe('A4_eccentricity');
    expect(getSubmissionFocusAnnex(
      'No complete reading pairs for A4_accuracy',
      testTypes,
    )).toBe('A4_accuracy');
  });

  it('falls back to English when Hindi is unavailable', () => {
    expect(getRuleFieldLabel({ labelEn: 'Load' }, 'HI')).toBe('Load');
    expect(getRuleFieldLabel({ labelEn: 'भार', labelHi: 'भार' }, 'HI')).toBe('भार');
  });
});