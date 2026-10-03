import request from 'supertest';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { setupTestDB, teardownTestDB, clearTestDB } from './testHelper.js';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Laboratory } from '../src/models/Laboratory.js';
import { Manufacturer } from '../src/models/Manufacturer.js';
import { InstrumentModel } from '../src/models/InstrumentModel.js';
import { TestSession } from '../src/models/TestSession.js';
import { Observation } from '../src/models/Observation.js';
import { Report } from '../src/models/Report.js';
import { RuleConfig } from '../src/models/RuleConfig.js';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';

function generateToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      labId: user.labId || null,
      tokenVersion: user.tokenVersion || 0,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

describe('WP0 Quick Defects Suite', () => {
  let adminUser, techUser, reviewerUser, mfgUser;
  let adminToken, techToken, reviewerToken, mfgToken;
  let lab, mfg, model, session;

  beforeAll(async () => {
    await setupTestDB();
  }, 120000);

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();

    const passwordHash = await bcrypt.hash('Password123!', 10);

    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@nawi.gov.in',
      passwordHash,
      role: 'admin',
    });
    adminToken = generateToken(adminUser);

    lab = await Laboratory.create({
      labId: 'LAB-DELHI-01',
      labName: 'NPL Delhi Central Metrology Lab',
      accreditationNo: 'NABL-DELHI-001',
      location: 'Delhi',
      isActive: true,
    });

    techUser = await User.create({
      name: 'Tech Delhi',
      email: 'tech@delhi.gov.in',
      passwordHash,
      role: 'lab_technician',
      labId: 'LAB-DELHI-01',
      laboratoryRef: lab._id,
    });
    techToken = generateToken(techUser);

    reviewerUser = await User.create({
      name: 'Reviewer Officer',
      email: 'reviewer@delhi.gov.in',
      passwordHash,
      role: 'reviewer',
      labId: 'LAB-DELHI-01',
    });
    reviewerToken = generateToken(reviewerUser);

    mfg = await Manufacturer.create({
      name: 'Acme Weighing Systems',
      contactEmail: 'mfg@acme.com',
    });

    mfgUser = await User.create({
      name: 'Mfg Rep',
      email: 'mfg@acme.com',
      passwordHash,
      role: 'manufacturer',
      manufacturerId: mfg._id,
    });
    mfgToken = generateToken(mfgUser);

    model = await InstrumentModel.create({
      manufacturerId: mfg._id,
      modelName: 'Acme-3000',
      accuracyClass: 'III',
      maxCapacity: 15,
      e: 0.005,
      minCapacity: 0.1,
      n: 3000,
    });

    await RuleConfig.create({
      accuracyClass: 'III',
      oimlEdition: 'OIML R-76-1 (2006)',
      sourceReference: 'Table 6, Section 3.5.1',
      validationNote: 'Approved rule config for testing',
      effectiveDate: new Date('2000-01-01'),
      status: 'active',
      isCurrentActive: true,
      createdBy: adminUser._id,
      approvedBy: adminUser._id,
      approvedAt: new Date(),
      bands: [
        { uptoMultipleOfE: 500, mpeFactor: 0.5 },
        { uptoMultipleOfE: 2000, mpeFactor: 1.0 },
        { uptoMultipleOfE: 10000, mpeFactor: 1.5 },
      ],
    });

    session = await TestSession.create({
      instrumentModelId: model._id,
      manufacturerName: mfg.name,
      modelName: model.modelName,
      serialNumber: 'SN-999',
      accuracyClass: 'III',
      maxCapacity: 15,
      minCapacity: 0.1,
      scaleInterval: 0.005,
      selectedAnnexes: ['A4_accuracy'],
      labId: lab.labId,
      laboratoryRef: lab._id,
      laboratoryName: lab.labName,
      createdBy: techUser._id,
      testDate: new Date(),
      verificationStage: 'initial',
      status: 'draft',
      environmentalConditions: { temperatureC: 22, humidityPercent: 55, inclinationDeg: 0, notes: 'Standard test environment' },
    });
  });

  test('Task 1: GET /ready checks MongoDB ping status', async () => {
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });

  test('Task 8: PATCH /api/test-sessions/:id updates draft session parameters and logs audit', async () => {
    const patchRes = await request(app)
      .patch(`/api/test-sessions/${session._id}`)
      .set('Authorization', `Bearer ${techToken}`)
      .send({
        serialNumber: 'SN-999-UPDATED',
        verificationStage: 'subsequent',
        environmentalConditions: { temperatureC: 25, humidityPercent: 60, inclinationDeg: 0, notes: 'Updated notes' },
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.success).toBe(true);
    expect(patchRes.body.data.serialNumber).toBe('SN-999-UPDATED');
    expect(patchRes.body.data.verificationStage).toBe('subsequent');
    expect(patchRes.body.data.environmentalConditions.temperatureC).toBe(25);
  });

  test('Task 5: POST /api/test-sessions/:id/submit is atomic with bulkWrite', async () => {
    await Observation.create({
      testSessionId: session._id,
      annexRef: 'A4_accuracy',
      evaluationMethod: 'mpe_band',
      referenceLoad: 5,
      indicatedValue: 5.001,
      zeroCorrection: 0,
    });

    const submitRes = await request(app)
      .post(`/api/test-sessions/${session._id}/submit`)
      .set('Authorization', `Bearer ${techToken}`);

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.success).toBe(true);
    expect(submitRes.body.data.session.status).toBe('under_review');
    expect(submitRes.body.data.session.overallResult).toBe('pass');

    const obsInDb = await Observation.findOne({ testSessionId: session._id });
    expect(obsInDb.outcome).toBe('pass');
    expect(obsInDb.computedError).toBe(0.001);
  });

  test('Task 9: POST /api/test-sessions/:id/observations/:obsId/acknowledge-flag updates flag with comment', async () => {
    const obs = await Observation.create({
      testSessionId: session._id,
      annexRef: 'A4_accuracy',
      evaluationMethod: 'mpe_band',
      referenceLoad: 5,
      indicatedValue: 5,
      outcome: 'pass',
      advisoryFlags: [
        {
          flagType: 'ANOMALY_ERROR_RATIO',
          zScore: 3.5,
          message: 'Error ratio anomaly',
          acknowledged: false,
        },
      ],
    });

    const flagId = obs.advisoryFlags[0]._id;

    const ackRes = await request(app)
      .post(`/api/test-sessions/${session._id}/observations/${obs._id}/acknowledge-flag`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ flagId, comment: 'Verified test setup; measurement valid.' });

    expect(ackRes.status).toBe(200);
    expect(ackRes.body.data.advisoryFlags[0].acknowledged).toBe(true);
    expect(ackRes.body.data.advisoryFlags[0].comment).toBe('Verified test setup; measurement valid.');
    expect(ackRes.body.data.outcome).toBe('pass');
  });

  test('Task 3: GET /api/instrument-models/:id/history sorts reports by revisionNumber desc and excludes revoked reports', async () => {
    session.status = 'passed';
    session.overallResult = 'pass';
    await session.save();

    const reportV1 = await Report.create({
      testSessionId: session._id,
      revisionNumber: 1,
      reportNumber: 'NAWI-2026-000001',
      contentHash: 'hash1',
      docxContentHash: 'docxhash1',
      hmacTag: 'hmac1',
      pdfPath: 'uploads/reports/NAWI-2026-000001.pdf',
      docxPath: 'uploads/reports/NAWI-2026-000001.docx',
      status: 'revoked',
      generatedBy: adminUser._id,
      generatedAt: new Date(),
    });

    const reportV2 = await Report.create({
      testSessionId: session._id,
      revisionNumber: 2,
      supersedesReportId: reportV1._id,
      reportNumber: 'NAWI-2026-000002',
      contentHash: 'hash2',
      docxContentHash: 'docxhash2',
      hmacTag: 'hmac2',
      pdfPath: 'uploads/reports/NAWI-2026-000002.pdf',
      docxPath: 'uploads/reports/NAWI-2026-000002.docx',
      status: 'published',
      generatedBy: adminUser._id,
      generatedAt: new Date(),
    });

    const historyRes = await request(app)
      .get(`/api/instrument-models/${model._id}/history`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data.length).toBe(1);
    expect(historyRes.body.data[0].report.reportNumber).toBe('NAWI-2026-000002');
  });

  test('Task 4: GET /api/dashboard/stats returns statusBreakdown and reportStatusBreakdown using aggregation', async () => {
    const statsRes = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(statsRes.status).toBe(200);
    expect(statsRes.body.success).toBe(true);
    expect(statsRes.body.data.statusBreakdown).toBeDefined();
    expect(statsRes.body.data.reportStatusBreakdown).toBeDefined();
    expect(statsRes.body.data.totalSessions).toBe(1);
  });
});
