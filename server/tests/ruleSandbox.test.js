import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../src/app.js';
import { setupTestDB, teardownTestDB } from './testHelper.js';
import { User } from '../src/models/User.js';
import { Manufacturer } from '../src/models/Manufacturer.js';
import { InstrumentModel } from '../src/models/InstrumentModel.js';
import { TestSession } from '../src/models/TestSession.js';
import { Observation } from '../src/models/Observation.js';
import { RuleConfig } from '../src/models/RuleConfig.js';
import { compareRuleConfigToHistory } from '../src/services/ruleSandbox.service.js';

describe('Rule configuration regression sandbox', () => {
  beforeAll(async () => setupTestDB());
  afterAll(async () => teardownTestDB());

  test('reports historical outcome changes under a draft without changing saved observations', async () => {
    await RuleConfig.deleteMany({});
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const author = await User.create({ name: 'Rule Author', email: 'sandbox-author@test.com', passwordHash, role: 'admin' });
    const expert = await User.create({ name: 'Rule Expert', email: 'sandbox-expert@test.com', passwordHash, role: 'metrology_expert' });
    const authorLogin = await request(app).post('/api/auth/login').send({ email: author.email, password: 'Password123!' });
    const expertLogin = await request(app).post('/api/auth/login').send({ email: expert.email, password: 'Password123!' });
    const manufacturer = await Manufacturer.create({ name: 'Sandbox Manufacturer', contactEmail: 'sandbox-mfg@test.com' });
    const model = await InstrumentModel.create({ manufacturerId: manufacturer._id, modelName: 'Sandbox Scale', accuracyClass: 'III', maxCapacity: 50, e: 0.1, minCapacity: 0.5, n: 500 });

    const active = await RuleConfig.create({
      oimlEdition: 'test baseline', accuracyClass: 'III', effectiveDate: new Date('2020-01-01'),
      sourceReference: 'test source', validationNote: 'test baseline', createdBy: author._id,
      approvedBy: expert._id, approvedAt: new Date(), status: 'active',
      bands: [{ uptoMultipleOfE: 1000, mpeFactor: 0.5 }],
    });
    const session = await TestSession.create({
      instrumentModelId: model._id, manufacturerName: manufacturer.name, modelName: model.modelName,
      serialNumber: 'SANDBOX-001', accuracyClass: 'III', maxCapacity: 50, minCapacity: 0.5,
      scaleInterval: 0.1, selectedAnnexes: ['A4_accuracy'], labId: 'SANDBOX-LAB',
      laboratoryRef: new mongoose.Types.ObjectId(), laboratoryName: 'Sandbox Lab', createdBy: author._id,
      testDate: new Date('2025-01-01'), verificationStage: 'initial', status: 'failed', overallResult: 'fail',
      environmentalConditions: { temperatureC: 22, humidityPercent: 50, inclinationDeg: 0, notes: 'test' },
    });
    const observation = await Observation.create({
      testSessionId: session._id, annexRef: 'A4_accuracy', evaluationMethod: 'mpe_band',
      referenceLoad: 10, indicatedValue: 10.08, outcome: 'fail', ruleConfigId: active._id,
    });

    const created = await request(app)
      .post('/api/rule-configs')
      .set('Authorization', `Bearer ${authorLogin.body.data.token}`)
      .send({
        oimlEdition: 'test draft', accuracyClass: 'III', effectiveDate: '2024-01-01',
        bands: [{ uptoMultipleOfE: 1000, mpeFactor: 1.5 }],
      });
    expect(created.status).toBe(201);
    const candidate = created.body.data;

    await request(app)
      .post(`/api/rule-configs/${candidate._id}/submit-review`)
      .set('Authorization', `Bearer ${expertLogin.body.data.token}`);
    
    // Simulate technical review by updating DB directly
    await RuleConfig.findByIdAndUpdate(candidate._id, { status: 'in_review', technicalReviewedBy: candidate.createdBy, technicalReviewedAt: new Date() });
    
    const dbRule = await RuleConfig.findById(candidate._id);
    console.log('dbRule:', dbRule);

    const beforeSandbox = await request(app)
      .post(`/api/rule-configs/${candidate._id}/activate`)
      .set('Authorization', `Bearer ${expertLogin.body.data.token}`)
      .send({ sourceReference: 'test source', validationNote: 'reviewed' });
    expect(beforeSandbox.status).toBe(409);
    expect(beforeSandbox.body.error.code).toBe('SANDBOX_REQUIRED');

    // Need to reset to draft to allow sandbox
    await RuleConfig.findByIdAndUpdate(candidate._id, { status: 'draft' });

    const sandboxResponse = await request(app)
      .post(`/api/rule-configs/${candidate._id}/sandbox`)
      .set('Authorization', `Bearer ${expertLogin.body.data.token}`);
    expect(sandboxResponse.status).toBe(200);
    const result = sandboxResponse.body.data;

    expect(result.compared).toBe(1);
    expect(result.changed).toBe(1);
    expect(result.changes[0]).toMatchObject({ previousOutcome: 'fail', proposedOutcome: 'pass' });
    expect(result.resultHash).toHaveLength(64);
    await RuleConfig.findByIdAndUpdate(candidate._id, { status: 'in_review' });

    const activated = await request(app)
      .post(`/api/rule-configs/${candidate._id}/activate`)
      .set('Authorization', `Bearer ${expertLogin.body.data.token}`)
      .send({ sourceReference: 'Legal Metrology Rules, test clause', validationNote: 'Reviewed comparison; confirmed outcome change is expected.' });
    expect(activated.status).toBe(200);
    expect(activated.body.data.status).toBe('active');
    const unchangedObservation = await Observation.findById(observation._id);
    expect(unchangedObservation.outcome).toBe('fail');
    expect(unchangedObservation.ruleConfigId.toString()).toBe(active._id.toString());

    const futureDraft = await request(app)
      .post('/api/rule-configs')
      .set('Authorization', `Bearer ${authorLogin.body.data.token}`)
      .send({
        oimlEdition: 'future test draft', accuracyClass: 'III', effectiveDate: '2099-01-01',
        bands: [{ uptoMultipleOfE: 1000, mpeFactor: 1.25 }],
      });
    expect(futureDraft.status).toBe(201);
    const futureSandbox = await request(app)
      .post(`/api/rule-configs/${futureDraft.body.data._id}/sandbox`)
      .set('Authorization', `Bearer ${expertLogin.body.data.token}`);
    expect(futureSandbox.status).toBe(200);
    await RuleConfig.findByIdAndUpdate(futureDraft.body.data._id, {
      status: 'in_review',
      technicalReviewedBy: futureDraft.body.data.createdBy,
      technicalReviewedAt: new Date()
    });

    const scheduled = await request(app)
      .post(`/api/rule-configs/${futureDraft.body.data._id}/activate`)
      .set('Authorization', `Bearer ${expertLogin.body.data.token}`)
      .send({ sourceReference: 'future test source', validationNote: 'future rule scheduling test' });
    expect(scheduled.status).toBe(200);
    expect(scheduled.body.data.status).toBe('scheduled');
    const superseded = await RuleConfig.findById(candidate._id);
    expect(superseded.status).toBe('archived');
    expect(superseded.effectiveUntil.toISOString()).toBe(new Date('2099-01-01').toISOString());
    expect(superseded.supersededByRuleId.toString()).toBe(futureDraft.body.data._id);

    const beforeEffectiveDate = await request(app)
      .get('/api/rule-configs?accuracyClass=III&effectiveDate=2098-12-31')
      .set('Authorization', `Bearer ${expertLogin.body.data.token}`);
    const onEffectiveDate = await request(app)
      .get('/api/rule-configs?accuracyClass=III&effectiveDate=2099-01-01')
      .set('Authorization', `Bearer ${expertLogin.body.data.token}`);
    expect(beforeEffectiveDate.body.data[0]._id).toBe(candidate._id);
    expect(onEffectiveDate.body.data[0]._id).toBe(futureDraft.body.data._id);
  });
});
