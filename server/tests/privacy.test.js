import { jest } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { setupTestDB, teardownTestDB, clearTestDB } from './testHelper.js';
import { User } from '../src/models/User.js';
import { TestSession } from '../src/models/TestSession.js';
import { InstrumentModel } from '../src/models/InstrumentModel.js';
import { Laboratory } from '../src/models/Laboratory.js';
import { Manufacturer } from '../src/models/Manufacturer.js';
import { Report } from '../src/models/Report.js';

jest.setTimeout(60000);

const login = async (email) => {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'pwd' });
  expect(res.status).toBe(200);
  return res.body.data.token;
};

const sessionBase = (model, mfg, lab, tech, serialNumber, status) => ({
  instrumentModelId: model._id,
  manufacturerName: mfg.name,
  modelName: model.modelName,
  serialNumber,
  accuracyClass: 'III',
  maxCapacity: 50,
  minCapacity: 0.5,
  scaleInterval: 0.1,
  selectedAnnexes: ['A4_accuracy'],
  labId: lab.labId,
  laboratoryRef: lab._id,
  laboratoryName: lab.labName,
  createdBy: tech._id,
  testDate: new Date(),
  verificationStage: 'initial',
  status,
  environmentalConditions: { temperatureC: 20, humidityPercent: 50, inclinationDeg: 0, notes: 'NA' },
});

const reportBase = (tech, n, testSessionId, status) => ({
  reportNumber: `REP-${n}`,
  testSessionId,
  status,
  contentHash: `hash-${n}`,
  hmacTag: `hmac-${n}`,
  pdfPath: `/dummy/${n}.pdf`,
  docxPath: `/dummy/${n}.docx`,
  generatedBy: tech._id,
  generatedAt: new Date(),
});

describe('Privacy Tests (Step 4)', () => {
  let techBToken, mfgAToken, mfgBToken;
  let modelA, sessionADraft, sessionAPublished, sessionBDraft;
  let reportAPublished, reportAUnpublished, reportBUnpublished;

  beforeAll(async () => {
    await setupTestDB();
    await clearTestDB();
    const hash = await bcrypt.hash('pwd', 10);

    const labA = await Laboratory.create({ labId: 'LAB-A', labName: 'Lab A', location: 'A', contactEmail: 'a@test.com', accreditationNo: 'NABL-A' });
    const labB = await Laboratory.create({ labId: 'LAB-B', labName: 'Lab B', location: 'B', contactEmail: 'b@test.com', accreditationNo: 'NABL-B' });

    const mfgA = await Manufacturer.create({ name: 'Mfg A', contactEmail: 'mfga@test.com' });
    const mfgB = await Manufacturer.create({ name: 'Mfg B', contactEmail: 'mfgb@test.com' });

    modelA = await InstrumentModel.create({ manufacturerId: mfgA._id, modelName: 'Model A', accuracyClass: 'III', maxCapacity: 50, e: 0.1, minCapacity: 0.5, n: 500 });
    const modelB = await InstrumentModel.create({ manufacturerId: mfgB._id, modelName: 'Model B', accuracyClass: 'III', maxCapacity: 50, e: 0.1, minCapacity: 0.5, n: 500 });

    const techA = await User.create({ name: 'Tech A', email: 'techa@test.com', passwordHash: hash, role: 'lab_technician', labId: labA.labId });
    const techB = await User.create({ name: 'Tech B', email: 'techb@test.com', passwordHash: hash, role: 'lab_technician', labId: labB.labId });
    await User.create({ name: 'Mfg A', email: 'usermfga@test.com', passwordHash: hash, role: 'manufacturer', manufacturerRef: mfgA._id });
    await User.create({ name: 'Mfg B', email: 'usermfgb@test.com', passwordHash: hash, role: 'manufacturer', manufacturerRef: mfgB._id });

    techBToken = await login('techb@test.com');
    mfgAToken = await login('usermfga@test.com');
    mfgBToken = await login('usermfgb@test.com');

    sessionADraft = await TestSession.create(sessionBase(modelA, mfgA, labA, techA, 'SN-A-1', 'draft'));
    sessionAPublished = await TestSession.create(sessionBase(modelA, mfgA, labA, techA, 'SN-A-2', 'published'));
    sessionBDraft = await TestSession.create(sessionBase(modelB, mfgB, labB, techB, 'SN-B-1', 'draft'));

    reportAUnpublished = await Report.create(reportBase(techA, 'A-UNPUB', sessionADraft._id, 'integrity_tagged'));
    reportAPublished = await Report.create(reportBase(techA, 'A-PUB', sessionAPublished._id, 'published'));
    reportBUnpublished = await Report.create(reportBase(techB, 'B-UNPUB', sessionBDraft._id, 'integrity_tagged'));
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  test('1. manufacturer: unpublished report by id -> 404', async () => {
    const res = await request(app).get(`/api/reports/${reportAUnpublished._id}`).set('Authorization', `Bearer ${mfgAToken}`);
    expect([403, 404]).toContain(res.status);
  });

  test('2. manufacturer: unpublished report absent from list', async () => {
    const res = await request(app).get('/api/reports').set('Authorization', `Bearer ${mfgAToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.reports.map((r) => r._id.toString());
    expect(ids).toContain(reportAPublished._id.toString());
    expect(ids).not.toContain(reportAUnpublished._id.toString());
  });

  test('3. manufacturer: own published report -> 200', async () => {
    const res = await request(app).get(`/api/reports/${reportAPublished._id}`).set('Authorization', `Bearer ${mfgAToken}`);
    expect(res.status).toBe(200);
  });

  test('4. manufacturer: other manufacturer published report -> 403 or 404', async () => {
    const res = await request(app).get(`/api/reports/${reportAPublished._id}`).set('Authorization', `Bearer ${mfgBToken}`);
    expect([403, 404]).toContain(res.status);
  });

  test('5. manufacturer: draft session -> 403 or 404', async () => {
    const res = await request(app).get(`/api/test-sessions/${sessionADraft._id}`).set('Authorization', `Bearer ${mfgAToken}`);
    expect([403, 404]).toContain(res.status);
  });

  test('6. lab B tech: no lab A session', async () => {
    const res = await request(app).get(`/api/test-sessions/${sessionADraft._id}`).set('Authorization', `Bearer ${techBToken}`);
    expect([403, 404]).toContain(res.status);
  });

  test('7. lab B tech: no lab A report list', async () => {
    const res = await request(app).get('/api/reports').set('Authorization', `Bearer ${techBToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.data.reports.map((r) => r._id.toString());
    expect(ids).toContain(reportBUnpublished._id.toString()); // proves the list is not just empty
    expect(ids).not.toContain(reportAPublished._id.toString());
    expect(ids).not.toContain(reportAUnpublished._id.toString());
  });

  test('8. lab B tech: no lab A dashboard numbers', async () => {
    const res = await request(app).get('/api/dashboard/stats').set('Authorization', `Bearer ${techBToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totalSessions).toBe(1);
    expect(res.body.data.totalReports).toBe(1);
    expect(Object.keys(res.body.data.sessionsByLab)).toEqual(['LAB-B']);
  });

  test('9. manufacturer dashboard excludes draft/under_review', async () => {
    const res = await request(app).get('/api/dashboard/stats').set('Authorization', `Bearer ${mfgAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.totalSessions).toBe(1);
    expect(res.body.data.statusBreakdown.draft).toBe(0);
    expect(res.body.data.statusBreakdown.published).toBe(1);
    expect(res.body.data.totalReports).toBe(1);
  });

  test('10. manufacturer model history scoped correctly', async () => {
    const res = await request(app).get(`/api/instrument-models/${modelA._id}/history`).set('Authorization', `Bearer ${mfgAToken}`);
    expect(res.status).toBe(200);
    const sessionIds = res.body.data.map((h) => h.session._id.toString());
    expect(sessionIds).toContain(sessionAPublished._id.toString());
    expect(sessionIds).not.toContain(sessionADraft._id.toString());
  });
});