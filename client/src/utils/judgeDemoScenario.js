import { DEFAULT_MANDATORY_ANNEXES } from '../config/constants.js';

export function buildJudgeDemoSessionForm(model, laboratory, now = new Date()) {
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  const timestamp = now.toISOString().replace(/\D/g, '').slice(0, 17);

  return {
    instrumentModelId: model._id || model.id,
    serialNumber: `DEMO-SN-${timestamp}`,
    labId: laboratory.labId || laboratory._id || laboratory.id,
    testDate: date,
    temperatureC: '22.5',
    humidityPercent: '55',
    inclinationDeg: '0',
    verificationStage: 'initial',
    envNotes: 'Judge demo sample values; replace with observed laboratory conditions for real testing.',
    selectedAnnexes: [...DEFAULT_MANDATORY_ANNEXES, 'A2_construction'],
  };
}
