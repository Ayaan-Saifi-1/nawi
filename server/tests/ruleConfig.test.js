import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { setupTestDB, teardownTestDB } from './testHelper.js';
import { User } from '../src/models/User.js';
import { RuleConfig } from '../src/models/RuleConfig.js';
import { TestType } from '../src/models/TestType.js';

describe('Rule Authoring Validation', () => {
  let adminToken;
  let expertToken;
  let expertId;

  beforeAll(async () => {
    await setupTestDB();
    const hash = await bcrypt.hash('Password123!', 10);
    const admin = await User.create({ name: 'Admin', email: 'rc-admin@test.com', passwordHash: hash, role: 'admin' });
    const expert = await User.create({ name: 'Expert', email: 'rc-expert@test.com', passwordHash: hash, role: 'metrology_expert' });
    expertId = expert._id;

    let res = await request(app).post('/api/auth/login').send({ email: 'rc-admin@test.com', password: 'Password123!' });
    adminToken = res.body.data.token;
    res = await request(app).post('/api/auth/login').send({ email: 'rc-expert@test.com', password: 'Password123!' });
    expertToken = res.body.data.token;
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  const validPayload = {
    oimlEdition: 'R76-2006',
    accuracyClass: 'III',
    effectiveDate: '2025-01-01',
    bands: [{ uptoMultipleOfE: 500, mpeFactor: 1 }],
    testCriteria: [{
      annexRef: 'A4_accuracy',
      fields: [{ name: 'reference', labelEn: 'Ref', type: 'number' }],
      criterion: { type: 'max_abs_error_le_mpe_factor', params: { factor: 1 } }
    }]
  };

  test('rejects creation if criterion.type is not in the enum', async () => {
    const payload = JSON.parse(JSON.stringify(validPayload));
    payload.testCriteria[0].criterion.type = 'invalid_type';
    const res = await request(app).post('/api/rule-configs').set('Authorization', `Bearer ${adminToken}`).send(payload);
    expect(res.status).toBe(400); // Zod validation fails
  });

  test('rejects creation if factor is not finite > 0', async () => {
    const payload = JSON.parse(JSON.stringify(validPayload));
    payload.testCriteria[0].criterion.params.factor = -1;
    const res = await request(app).post('/api/rule-configs').set('Authorization', `Bearer ${adminToken}`).send(payload);
    expect(res.status).toBe(400);
  });

  test('rejects creation if bands is empty', async () => {
    const payload = JSON.parse(JSON.stringify(validPayload));
    payload.bands = [];
    const res = await request(app).post('/api/rule-configs').set('Authorization', `Bearer ${adminToken}`).send(payload);
    expect(res.status).toBe(400);
  });

  test('rejects creation if uptoMultipleOfE is not strictly ascending', async () => {
    const payload = JSON.parse(JSON.stringify(validPayload));
    payload.bands = [{ uptoMultipleOfE: 500, mpeFactor: 1 }, { uptoMultipleOfE: 500, mpeFactor: 2 }];
    const res = await request(app).post('/api/rule-configs').set('Authorization', `Bearer ${adminToken}`).send(payload);
    expect(res.status).toBe(400);
  });

  test('rejects creation if mpeFactor is <= 0', async () => {
    const payload = JSON.parse(JSON.stringify(validPayload));
    payload.bands[0].mpeFactor = 0;
    const res = await request(app).post('/api/rule-configs').set('Authorization', `Bearer ${adminToken}`).send(payload);
    expect(res.status).toBe(400);
  });

  test('rejects creation if annexRef is not in ANNEX_REFS', async () => {
    const payload = JSON.parse(JSON.stringify(validPayload));
    payload.testCriteria[0].annexRef = 'INVALID_ANNEX';
    const res = await request(app).post('/api/rule-configs').set('Authorization', `Bearer ${adminToken}`).send(payload);
    expect(res.status).toBe(400);
  });

  test('rejects creation if duplicate annexRef', async () => {
    const payload = JSON.parse(JSON.stringify(validPayload));
    payload.testCriteria.push(JSON.parse(JSON.stringify(payload.testCriteria[0])));
    const res = await request(app).post('/api/rule-configs').set('Authorization', `Bearer ${adminToken}`).send(payload);
    expect(res.status).toBe(400);
  });

  test('Activation guard: reject (422) if an annex required by an approved active TestType has no criterion', async () => {
    // Create an approved active TestType that is mandatory for Class III
    await TestType.create({
      testTypeId: 'TT-MANDATORY',
      testName: 'Mandatory Test',
      oimlAnnexRef: 'A5_tare',
      mandatoryFor: [{ accuracyClass: 'III', verificationStage: 'all' }],
      isActive: true,
      status: 'approved'
    });

    const ruleConfig = await RuleConfig.create({
      ...validPayload,
      status: 'in_review', // bypass draft
      createdBy: expertId, // some other user created it
      technicalReviewedBy: expertId,
      sandboxedAt: new Date(),
      sandboxResultHash: 'hash',
      sandboxSummary: { uncomparable: 0 }
    });
    // Another expert must approve
    const hash = await bcrypt.hash('pwd', 10);
    const expert2 = await User.create({ name: 'Exp2', email: 'exp2@test.com', passwordHash: hash, role: 'metrology_expert' });
    const loginRes = await request(app).post('/api/auth/login').send({ email: 'exp2@test.com', password: 'pwd' });
    const expert2Token = loginRes.body.data.token;

    const res = await request(app)
      .post(`/api/rule-configs/${ruleConfig._id}/activate`)
      .set('Authorization', `Bearer ${expert2Token}`)
      .send({ sourceReference: 'Src', validationNote: 'Note' });

    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/missing a criterion for mandatory test type: A5_tare/);
  });
});
