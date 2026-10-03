import mongoose from 'mongoose';
import { setupTestDB, teardownTestDB, clearTestDB } from './testHelper.js';
import { seedDemoData } from '../src/seed/seedDemoData.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { Report } from '../src/models/Report.js';
import { Observation } from '../src/models/Observation.js';
import { TestSession } from '../src/models/TestSession.js';

describe('Demo seed', () => {
  beforeAll(async () => {
    await setupTestDB();
  }, 120000);

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  test('preserves append-only audit logs and leaves report generation to the normal flow', async () => {
    const existingAuditLog = await AuditLog.create({
      entityType: 'TestSession',
      entityId: new mongoose.Types.ObjectId(),
      action: 'SEED_REGRESSION',
      userId: new mongoose.Types.ObjectId(),
      prevHash: '0'.repeat(64),
      currentHash: '1'.repeat(64),
    });

    const result = await seedDemoData();

    expect(result.sessionsCount).toBe(20);
    expect(result.reportsCount).toBe(0);
    expect(await Report.countDocuments()).toBe(0);
    expect(await Observation.countDocuments()).toBe(10);
    const seededSessions = await TestSession.find().select('testDate status labId');
    const seededMonths = [...new Set(seededSessions
      .map((session) => session.testDate.toISOString().slice(0, 7))
      .sort())];
    expect(seededMonths).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
    const draftSessions = seededSessions.filter((session) => session.status === 'draft');
    expect(draftSessions).toHaveLength(6);
    expect(draftSessions.every((session) => session.labId === 'LAB-DELHI-01')).toBe(true);
    expect(await AuditLog.exists({ _id: existingAuditLog._id })).toBeTruthy();
    expect(await AuditLog.countDocuments()).toBeGreaterThan(1);
  }, 120000);
});
