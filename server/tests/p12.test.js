import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../src/app.js';
import { setupTestDB, teardownTestDB, clearTestDB } from './testHelper.js';
import bcrypt from 'bcryptjs';
import { User } from '../src/models/User.js';
import { TestSession } from '../src/models/TestSession.js';
import { Observation } from '../src/models/Observation.js';
import { InstrumentModel } from '../src/models/InstrumentModel.js';
import { Laboratory } from '../src/models/Laboratory.js';
import { RuleConfig } from '../src/models/RuleConfig.js';
import { evaluateObservation } from '../src/services/complianceEngine.service.js';

import { seedUsers } from '../src/seed/seedUsers.js';
import { seedRuleConfigs } from '../src/seed/seedRuleConfigs.js';

jest.setTimeout(60000);

let adminToken, techToken, reviewerToken, manufacturerToken;
let lab, model, ruleConfig;

beforeAll(async () => {
  await setupTestDB();
});

afterAll(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await clearTestDB();
  const seedData = await seedUsers();
  await seedRuleConfigs();

  // Activate seeded rule configs with full metadata
  const adminUser = await User.findOne({ role: 'admin' });
  const expertUser = await User.findOne({ role: 'metrology_expert' });
  await RuleConfig.updateMany(
    {},
    {
      status: 'active',
      sourceReference: 'OIML R-76-1:2006 Technical Requirements',
      validationNote: 'Validated by metrology expert',
      createdBy: adminUser._id,
      approvedBy: expertUser._id,
      approvedAt: new Date(),
    }
  );

  lab = (await Laboratory.findOne({ labId: 'LAB-DELHI-01' })) || (await Laboratory.create({
    labId: 'LAB-DELHI-01',
    labName: 'Test Metrology Laboratory',
    accreditationNo: 'TEST-ACCREDITATION',
    location: 'New Delhi',
    isActive: true,
  }));

  model = await InstrumentModel.create({
    manufacturerId: seedData.manufacturer._id,
    modelName: 'MODEL-SEC-100',
    accuracyClass: 'III',
    maxCapacity: 3000,
    e: 1.0,
    minCapacity: 20,
    n: 3000,
  });

  // Register users
  const adminRes = await request(app).post('/api/auth/login').send({ email: 'admin@nawi.gov.in', password: 'Password123!' });
  expect(adminRes.status).toBe(200);
  adminToken = adminRes.body.data.token;

  const techRes = await request(app).post('/api/auth/login').send({ email: 'tech@npl.res.in', password: 'Password123!' });
  expect(techRes.status).toBe(200);
  techToken = techRes.body.data.token;

  const revRes = await request(app).post('/api/auth/login').send({ email: 'reviewer@doca.gov.in', password: 'Password123!' });
  expect(revRes.status).toBe(200);
  reviewerToken = revRes.body.data.token;

  const mfrRes = await request(app).post('/api/auth/login').send({ email: 'rep@averyindia.com', password: 'Password123!' });
  expect(mfrRes.status).toBe(200);
  manufacturerToken = mfrRes.body.data.token;
});

describe('P12 — Security & Delivery Hardening', () => {
  test('Upload validation rejects fake files with invalid magic bytes', async () => {
    const sessionRes = await request(app)
      .post('/api/test-sessions')
      .set('Authorization', `Bearer ${techToken}`)
      .send({
        instrumentModelId: model._id,
        serialNumber: 'SN-MAGIC-01',
        testDate: '2026-03-01',
        selectedAnnexes: ['A3_initial_examination'],
        environmentalConditions: {
          temperatureC: 22,
          humidityPercent: 50,
          inclinationDeg: 0,
          notes: 'Standard room conditions',
        },
      });

    expect(sessionRes.status).toBe(201);
    const sessionId = sessionRes.body.data._id;
    const fakeFileBuffer = Buffer.from([0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb]);

    const res = await request(app)
      .post(`/api/test-sessions/${sessionId}/attachments`)
      .set('Authorization', `Bearer ${techToken}`)
      .field('fileType', 'photo')
      .attach('file', fakeFileBuffer, 'test.png');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
  });

  test('Account lockout locks user after 5 failed login attempts', async () => {
    const hash = bcrypt.hashSync('Password123!', 10);
    const lockoutUser = await User.create({
      name: 'Lockout Test User',
      email: 'lockout@npl.res.in',
      passwordHash: hash,
      role: 'lab_technician',
      labId: 'LAB-DELHI-01',
    });

    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/auth/login').send({ email: lockoutUser.email, password: 'WrongPassword!' });
      expect(res.status).toBe(401);
    }

    // 6th attempt should be locked (423)
    const lockedRes = await request(app).post('/api/auth/login').send({ email: lockoutUser.email, password: 'WrongPassword!' });
    expect(lockedRes.status).toBe(423);
    expect(lockedRes.body.error.code).toBe('ACCOUNT_LOCKED');
  });

  test('Change password endpoint verifies current password and enforces password policy', async () => {
    const hash = bcrypt.hashSync('Password123!', 10);
    const chgUser = await User.create({
      name: 'Change Pass User',
      email: 'chgpass@npl.res.in',
      passwordHash: hash,
      role: 'lab_technician',
      labId: 'LAB-DELHI-01',
    });

    const chgLogin = await request(app).post('/api/auth/login').send({ email: chgUser.email, password: 'Password123!' });
    const chgToken = chgLogin.body.data.token;

    // Weak new password
    const weakRes = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${chgToken}`)
      .send({ currentPassword: 'Password123!', newPassword: 'weak' });
    expect(weakRes.status).toBe(400);

    // Wrong current password
    const wrongRes = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${chgToken}`)
      .send({ currentPassword: 'WrongPassword!', newPassword: 'NewSecurePass123!' });
    expect(wrongRes.status).toBe(400);

    // Success
    const successRes = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${chgToken}`)
      .send({ currentPassword: 'Password123!', newPassword: 'NewSecurePass123!' });
    expect(successRes.status).toBe(200);

    // Login with new password
    const loginNew = await request(app).post('/api/auth/login').send({ email: chgUser.email, password: 'NewSecurePass123!' });
    expect(loginNew.status).toBe(200);
  });

  test('Role x Endpoint Matrix: verify 401/403/200 explicitly across roles', async () => {
    // Unauthenticated access
    const unauthRes = await request(app).get('/api/audit-log');
    expect(unauthRes.status).toBe(401);

    // Manufacturer creating test session (forbidden -> 403)
    const mfrCreate = await request(app)
      .post('/api/test-sessions')
      .set('Authorization', `Bearer ${manufacturerToken}`)
      .send({
        instrumentModelId: model._id,
        serialNumber: 'SN-MFR-01',
        testDate: '2026-03-01',
        selectedAnnexes: ['A3_initial_examination'],
      });
    expect(mfrCreate.status).toBe(403);

    // Reviewer creating test session (forbidden -> 403)
    const revCreate = await request(app)
      .post('/api/test-sessions')
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({
        instrumentModelId: model._id,
        serialNumber: 'SN-REV-01',
        testDate: '2026-03-01',
        selectedAnnexes: ['A3_initial_examination'],
      });
    expect(revCreate.status).toBe(403);

    // Admin creating rule config -> 201
    const ruleRes = await request(app)
      .post('/api/rule-configs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        oimlEdition: 'R76-1:2006',
        accuracyClass: 'II',
        effectiveDate: '2026-01-01',
        bands: [{ uptoMultipleOfE: 5000, mpeFactor: 0.5 }],
      });
    expect(ruleRes.status).toBe(201);

    // Create a mock session to test report scope
    const mockSession = await TestSession.create({
      instrumentModelId: model._id,
      manufacturerName: 'Avery India Ltd',
      modelName: 'MODEL-SEC-100',
      serialNumber: 'TEST-123',
      accuracyClass: 'III',
      maxCapacity: 3000,
      minCapacity: 20,
      scaleInterval: 1.0,
      selectedAnnexes: ['A3_initial_examination'],
      labId: 'OTHER-LAB-01',
      laboratoryRef: lab._id,
      laboratoryName: 'Other Laboratory',
      environmentalConditions: {
        temperatureC: 22,
        humidityPercent: 50,
        inclinationDeg: 0,
        notes: 'Room conditions',
      },
      createdBy: (await User.findOne({ email: 'tech@npl.res.in' }))._id,
      testDate: new Date(),
      status: 'published',
    });

    // Test session scope for user
    const techScopeRes = await request(app)
      .get(`/api/test-sessions/${mockSession._id}`)
      .set('Authorization', `Bearer ${techToken}`); // Tech is from LAB-DELHI-01
    expect(techScopeRes.status).toBe(403); // Forbidden because wrong lab

    const mfrScopeRes = await request(app)
      .get(`/api/test-sessions/${mockSession._id}`)
      .set('Authorization', `Bearer ${manufacturerToken}`);
    expect(mfrScopeRes.status).toBe(200); // Mfr owns this model, so 200
  });

  test('Expanded Known-Answer OIML R-76 MPE evaluation', async () => {
    const inst = { accuracyClass: 'III', maxCapacity: 1500, e: 0.5 };
    const rConfig = {
      bands: [
        { uptoMultipleOfE: 500, mpeFactor: 0.5 },
        { uptoMultipleOfE: 2000, mpeFactor: 1.0 },
        { uptoMultipleOfE: 10000, mpeFactor: 1.5 },
      ],
    };

    // Load = 100kg (n=200): MPE = 0.5e = 0.25kg
    const obsPass = evaluateObservation(
      { referenceLoad: 100, indicatedValue: 100.2, zeroCorrection: 0, evaluationMethod: 'mpe_band', annexRef: 'A4_accuracy' },
      inst,
      rConfig,
      'initial'
    );
    expect(obsPass.computedError).toBe(0.2);
    expect(obsPass.appliedMpe).toBe(0.25);
    expect(obsPass.outcome).toBe('pass');

    // Load = 1000kg (n=2000): MPE = 1.0e = 0.5kg
    const obsFail = evaluateObservation(
      { referenceLoad: 1000, indicatedValue: 1000.7, zeroCorrection: 0, evaluationMethod: 'mpe_band', annexRef: 'A4_accuracy' },
      inst,
      rConfig,
      'initial'
    );
    expect(obsFail.computedError).toBe(0.7);
    expect(obsFail.appliedMpe).toBe(0.5);
    expect(obsFail.outcome).toBe('fail');
  });
});

describe('P13 — Advisory Anomaly Flags (G18)', () => {
  test('Triggers advisory anomaly flag when errorRatioE deviates > 3.5 Z-score after 10 prior observations, without changing outcome', async () => {
    // Create 10 historical sessions with errorRatioE around 0.1
    for (let i = 0; i < 10; i++) {
      const s = await TestSession.create({
        instrumentModelId: model._id,
        manufacturerName: 'Avery India Ltd',
        modelName: 'MODEL-SEC-100',
        serialNumber: `SN-HIST-${i}`,
        accuracyClass: 'III',
        maxCapacity: 3000,
        minCapacity: 20,
        scaleInterval: 1.0,
        selectedAnnexes: ['A4_accuracy'],
        labId: 'LAB-DELHI-01',
        laboratoryRef: lab._id,
        laboratoryName: lab.labName,
        environmentalConditions: {
          temperatureC: 23,
          humidityPercent: 50,
          inclinationDeg: 0,
          notes: 'Standard room conditions',
        },
        createdBy: (await User.findOne({ email: 'tech@npl.res.in' }))._id,
        testDate: '2026-03-01',
        status: 'passed',
        overallResult: 'pass',
      });

      await Observation.create({
        testSessionId: s._id,
        annexRef: 'A4_accuracy',
        evaluationMethod: 'mpe_band',
        referenceLoad: 100,
        indicatedValue: 100.1,
        computedError: 0.1,
        appliedMpe: 0.5,
        errorRatioE: 0.2, // 0.1 / 0.5 = 0.2
        outcome: 'pass',
      });
    }

    // Submit 11th session with extreme indicatedValue (computedError = 0.45, appliedMpe = 0.5, errorRatioE = 0.9)
    const newSessionRes = await request(app)
      .post('/api/test-sessions')
      .set('Authorization', `Bearer ${techToken}`)
      .send({
        instrumentModelId: model._id,
        serialNumber: 'SN-ANOMALY-11',
        testDate: '2026-03-01',
        selectedAnnexes: ['A4_accuracy'],
        environmentalConditions: {
          temperatureC: 22,
          humidityPercent: 50,
          inclinationDeg: 0,
          notes: 'Standard room conditions',
        },
      });
    expect(newSessionRes.status).toBe(201);
    const sessionId = newSessionRes.body.data._id;

    const obsRes = await request(app)
      .post(`/api/test-sessions/${sessionId}/observations`)
      .set('Authorization', `Bearer ${techToken}`)
      .send({
        observations: [
          {
            annexRef: 'A4_accuracy',
            evaluationMethod: 'structured',
            readings: [{ load: 100, reference: 100, indicated: 100.45 }],
          },
        ],
      });
    expect(obsRes.status).toBe(201);

    const submitRes = await request(app)
      .post(`/api/test-sessions/${sessionId}/submit`)
      .set('Authorization', `Bearer ${techToken}`);

    expect(submitRes.status).toBe(200);
    const obs = submitRes.body.data.observations[0];

    // Outcome MUST still be pass!
    expect(obs.outcome).toBe('pass');
    expect(submitRes.body.data.session.overallResult).toBe('pass');

    // Advisory flag MUST be populated
    expect(obs.advisoryFlags).toBeDefined();
    expect(obs.advisoryFlags.length).toBeGreaterThan(0);
    expect(obs.advisoryFlags[0].flagType).toBe('ANOMALY_ERROR_RATIO');
    expect(obs.advisoryFlags[0].acknowledged).toBe(false);

    // Reviewer acknowledges flag
    const ackRes = await request(app)
      .post(`/api/test-sessions/${sessionId}/observations/${obs._id}/acknowledge-flag`)
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(ackRes.status).toBe(200);
    expect(ackRes.body.data.advisoryFlags[0].acknowledged).toBe(true);
  });
});