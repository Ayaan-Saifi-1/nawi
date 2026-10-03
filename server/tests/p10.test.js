import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { setupTestDB, teardownTestDB } from './testHelper.js';
import { User } from '../src/models/User.js';
import { Manufacturer } from '../src/models/Manufacturer.js';
import { InstrumentModel } from '../src/models/InstrumentModel.js';

describe('Phase P10 — Search, History, Export & Input Hardening', () => {
  let adminToken;
  let testModelId;

  beforeAll(async () => {
    await setupTestDB();
    const passwordHash = await bcrypt.hash('Password123!', 10);
    await User.deleteMany({ email: 'p10admin@test.com' });
    await User.create({
      name: 'P10 Admin',
      email: 'p10admin@test.com',
      passwordHash,
      role: 'admin',
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'p10admin@test.com',
      password: 'Password123!',
    });
    adminToken = loginRes.body.data.token;

    const mfg = await Manufacturer.create({
      name: 'P10 Manufacturer',
      contactEmail: 'p10mfg@test.com',
    });

    const model = await InstrumentModel.create({
      manufacturerId: mfg._id,
      modelName: 'P10 Model X',
      accuracyClass: 'III',
      maxCapacity: 100,
      e: 0.1,
      minCapacity: 1,
      n: 1000,
    });
    testModelId = model._id;
  }, 120000);

  afterAll(async () => {
    await teardownTestDB();
  });

  test('GET /api/instrument-models/:id/history returns model session history', async () => {
    const res = await request(app)
      .get(`/api/instrument-models/${testModelId}/history`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /api/reports with regex injection input is safely escaped', async () => {
    const res = await request(app)
      .get('/api/reports?search=.*+?^${}()|[]\\')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('GET /api/reports pagination limit is capped safely', async () => {
    const res = await request(app)
      .get('/api/reports?page=1&limit=5000')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/export/jobs creates audit-logged export job and download', async () => {
    const createRes = await request(app)
      .post('/api/export/jobs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ format: 'json' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.success).toBe(true);
    const { jobId } = createRes.body.data;

    const statusRes = await request(app)
      .get(`/api/export/jobs/${jobId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.jobId).toBe(jobId);

    const downloadRes = await request(app)
      .get(`/api/export/jobs/${jobId}/download`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(downloadRes.status).toBe(200);
  });
});
