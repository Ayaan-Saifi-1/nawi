import request from 'supertest';
import { setupTestDB, teardownTestDB } from './testHelper.js';
import app from '../src/app.js';
import { readStoredFile, removeStoredFile, storeFile } from '../src/services/fileStorage.service.js';

describe('Vercel GridFS file storage', () => {
  const originalVercel = process.env.VERCEL;
  const originalCronSecret = process.env.CRON_SECRET;

  beforeAll(async () => {
    await setupTestDB();
    process.env.VERCEL = '1';
  });

  afterAll(async () => {
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCronSecret;
    await teardownTestDB();
  });

  test('persists and reads a file by GridFS id, then deletes it', async () => {
    const contents = Buffer.from('persistent Vercel artifact');
    const stored = await storeFile(`test/${Date.now()}.txt`, contents);

    expect(stored.storageFileId).toMatch(/^[a-f\d]{24}$/i);
    await expect(readStoredFile({ storageFileId: stored.storageFileId })).resolves.toEqual(contents);

    await removeStoredFile({ storageFileId: stored.storageFileId });
    await expect(readStoredFile({ storageFileId: stored.storageFileId })).rejects.toMatchObject({
      statusCode: 404,
      code: 'FILE_NOT_FOUND',
    });
  });

  test('protects the scheduled activation endpoint with a bearer secret', async () => {
    process.env.CRON_SECRET = 'test_cron_secret_value';

    const unauthorized = await request(app).get('/api/cron/activate-rules');
    expect(unauthorized.status).toBe(401);

    const authorized = await request(app)
      .get('/api/cron/activate-rules')
      .set('Authorization', `Bearer ${process.env.CRON_SECRET}`);
    expect(authorized.status).toBe(200);
    expect(authorized.body).toEqual({ success: true });
  });
});
