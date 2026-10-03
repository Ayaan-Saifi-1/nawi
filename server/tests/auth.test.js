import request from 'supertest';
import bcrypt from 'bcryptjs';
import { setupTestDB, teardownTestDB } from './testHelper.js';
import app from '../src/app.js';
import { User } from '../src/models/User.js';

describe('Auth & Role API Routes', () => {
  beforeAll(async () => {
    await setupTestDB();
  }, 120000);

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  test('POST /api/auth/login returns JWT token for valid credentials', async () => {
    const passwordHash = await bcrypt.hash('Password123!', 10);
    await User.create({
      name: 'System Admin',
      email: 'admin@test.com',
      passwordHash,
      role: 'admin',
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'admin@test.com',
      password: 'Password123!',
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.token).toBeDefined();
    expect(loginRes.body.data.user.email).toBe('admin@test.com');
  });

  test('POST /api/auth/register (admin registers technician)', async () => {
    const passwordHash = await bcrypt.hash('Password123!', 10);
    await User.create({
      name: 'System Admin',
      email: 'admin@test.com',
      passwordHash,
      role: 'admin',
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'admin@test.com',
      password: 'Password123!',
    });

    const token = loginRes.body.data.token;

    const registerRes = await request(app)
      .post('/api/auth/register')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Tech Delhi',
        email: 'tech@delhi.gov.in',
        password: 'Password123!',
        role: 'lab_technician',
        labId: 'LAB-DELHI-01',
      });

    expect(registerRes.status).toBe(201);
    expect(registerRes.body.success).toBe(true);
    expect(registerRes.body.data.email).toBe('tech@delhi.gov.in');
    expect(registerRes.body.data.role).toBe('lab_technician');
  });

  test('POST /api/auth/login returns 401 for invalid credentials', async () => {
    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'nonexistent@test.com',
      password: 'WrongPassword',
    });

    expect(loginRes.status).toBe(401);
    expect(loginRes.body.success).toBe(false);
    expect(loginRes.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});
