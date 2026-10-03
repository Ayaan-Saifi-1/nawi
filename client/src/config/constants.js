// API base URL (proxied through Vite in dev)
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const ACCURACY_CLASSES = ['I', 'II', 'III', 'IIII'];

export const SESSION_STATUSES = ['draft', 'under_review', 'passed', 'failed', 'report_generated', 'published', 'revoked', 'archived'];

export const ANNEX_REFS = [
  { value: 'A1_administrative',        label: 'A.1 — Administrative / Documentary Check',  method: 'manual_checklist' },
  { value: 'A2_construction',          label: 'A.2 — Construction Examination',             method: 'manual_checklist' },
  { value: 'A3_initial_examination',    label: 'A.3 — Initial Examination',                  method: 'manual_checklist' },
  { value: 'A4_discrimination',        label: 'A.4 — Discrimination Test',                  method: 'manual_checklist' },
  { value: 'A4_repeatability',         label: 'A.4 — Repeatability Test',                   method: 'structured' },
  { value: 'A4_eccentricity',          label: 'A.4 — Eccentricity Test',                    method: 'structured' },
  { value: 'A4_accuracy',              label: 'A.4 — Accuracy / Performance Test',          method: 'mpe_band' },
  { value: 'A5_temperature',           label: 'A.5 — Temperature Influence Factor',         method: 'manual_checklist' },
  { value: 'A5_humidity',              label: 'A.5 — Humidity Influence Factor',             method: 'manual_checklist' },
  { value: 'A5_inclination',           label: 'A.5 — Inclination Influence Factor',          method: 'manual_checklist' },
  { value: 'A6_endurance',             label: 'A.6 — Endurance Test',                       method: 'manual_checklist' },
  { value: 'B_electronic_additional',  label: 'Annex B — Electronic Additional Tests',      method: 'manual_checklist' },
];

export const DEFAULT_MANDATORY_ANNEXES = [
  'A1_administrative',
  'A4_accuracy',
  'A4_eccentricity',
  'A4_repeatability',
  'A4_discrimination',
];

export const CLASS_BOUNDS = {
  I:    { nMin: 50000, nMax: null   },
  II:   { nMin: 100,   nMax: 100000 },
  III:  { nMin: 100,   nMax: 10000  },
  IIII: { nMin: 100,   nMax: 1000   },
};
