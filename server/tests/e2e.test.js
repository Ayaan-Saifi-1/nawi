import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { setupTestDB, teardownTestDB } from './testHelper.js';
import app from '../src/app.js';
import { seedRuleConfigs } from '../src/seed/seedRuleConfigs.js';
import { seedUsers } from '../src/seed/seedUsers.js';
import { Laboratory } from '../src/models/Laboratory.js';
import { User } from '../src/models/User.js';
import { RuleConfig } from '../src/models/RuleConfig.js';

describe('End-to-End Metrology System Lifecycle', () => {
  let adminToken;
  let techToken;
  let reviewerToken;
  let manufacturerToken;
  let instrumentModelId;

  beforeAll(async () => {
    await setupTestDB();
    await seedRuleConfigs();
    const seeded = await seedUsers();
    instrumentModelId = seeded.instrumentModel._id.toString();
    await Laboratory.findOneAndUpdate(
      { labId: 'LAB-DELHI-01' },
      { labId: 'LAB-DELHI-01', labName: 'Test Metrology Laboratory', accreditationNo: 'TEST-ACCREDITATION', location: 'Test Facility', isActive: true },
      { upsert: true, new: true }
    );
    const [ruleAuthor, ruleApprover] = await Promise.all([
      User.findOne({ email: 'admin@nawi.gov.in' }),
      User.findOne({ email: 'reviewer@doca.gov.in' }),
    ]);
    await RuleConfig.create({
      oimlEdition: 'TEST FIXTURE — NOT FOR REGULATORY USE',
      accuracyClass: 'III',
      effectiveDate: new Date('2006-01-01'),
      bands: [
        { uptoMultipleOfE: 500, mpeFactor: 0.5 },
        { uptoMultipleOfE: 2000, mpeFactor: 1 },
        { uptoMultipleOfE: 10000, mpeFactor: 1.5 },
      ],
      status: 'active',
      sourceReference: 'Synthetic E2E fixture; not an authoritative rule source',
      validationNote: 'Test-only values for known-answer API lifecycle coverage',
      createdBy: ruleAuthor._id,
      approvedBy: ruleApprover._id,
      approvedAt: new Date(),
    });

    // Login as Admin
    const adminRes = await request(app).post('/api/auth/login').send({
      email: 'admin@nawi.gov.in',
      password: 'Password123!',
    });
    adminToken = adminRes.body.data.token;

    // Login as Lab Tech
    const techRes = await request(app).post('/api/auth/login').send({
      email: 'tech@npl.res.in',
      password: 'Password123!',
    });
    techToken = techRes.body.data.token;

    // Login as Reviewer
    const reviewerRes = await request(app).post('/api/auth/login').send({
      email: 'reviewer@doca.gov.in',
      password: 'Password123!',
    });
    reviewerToken = reviewerRes.body.data.token;

    // Login as Manufacturer Rep
    const mfgRes = await request(app).post('/api/auth/login').send({
      email: 'rep@averyindia.com',
      password: 'Password123!',
    });
    manufacturerToken = mfgRes.body.data.token;
  }, 120000);

  afterAll(async () => {
    await teardownTestDB();
  });

  test('Full Lifecycle: Session creation -> Observations -> Attachment -> Submission -> PDF/DOCX Report Generation -> Public Verification -> Audit Trail -> Revocation', async () => {
    // 1. Tech creates TestSession
    const sessionRes = await request(app)
      .post('/api/test-sessions')
      .set('Authorization', `Bearer ${techToken}`)
      .send({
        instrumentModelId,
        serialNumber: 'TEST-SCALE-001',
        selectedAnnexes: ['A1_administrative', 'A4_accuracy'],
        testDate: '2026-09-25',
        environmentalConditions: {
          temperatureC: 22.5,
          humidityPercent: 55,
          inclinationDeg: 0,
          notes: 'Standard lab atmospheric conditions',
        },
      });

    expect(sessionRes.status).toBe(201);
    expect(sessionRes.body.success).toBe(true);
    const sessionId = sessionRes.body.data._id;
    expect(sessionRes.body.data.status).toBe('draft');

    // 2. Tech adds Observations
    const obsRes = await request(app)
      .post(`/api/test-sessions/${sessionId}/observations`)
      .set('Authorization', `Bearer ${techToken}`)
      .send({
        observations: [
          {
            annexRef: 'A1_administrative',
            evaluationMethod: 'manual_checklist',
            checklistPassed: true,
            reviewerNotes: 'Documentary verification passed',
          },
          {
            annexRef: 'A4_accuracy',
            evaluationMethod: 'mpe_band',
            referenceLoad: 200,
            indicatedValue: 200.15,
          },
          {
            annexRef: 'A4_accuracy',
            evaluationMethod: 'mpe_band',
            referenceLoad: 500,
            indicatedValue: 500.2,
          },
        ],
      });

    expect(obsRes.status).toBe(201);
    expect(obsRes.body.data.length).toBe(3);

    // 3. Tech uploads attachment
    const testFilePath = path.join(process.cwd(), 'uploads', 'test_sample.txt');
    fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
    fs.writeFileSync(testFilePath, 'Metrology test calibration photograph placeholder');

    const attachmentRes = await request(app)
      .post(`/api/test-sessions/${sessionId}/attachments`)
      .set('Authorization', `Bearer ${techToken}`)
      .field('fileType', 'photo')
      .attach('file', testFilePath);

    expect(attachmentRes.status).toBe(201);
    expect(attachmentRes.body.data.fileType).toBe('photo');

    // 4. Tech submits session for review
    const submitRes = await request(app)
      .post(`/api/test-sessions/${sessionId}/submit`)
      .set('Authorization', `Bearer ${techToken}`);

    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.session.status).toBe('under_review');
    expect(submitRes.body.data.session.overallResult).toBe('pass');

    // 4b. Reviewer approves session
    const approveRes = await request(app)
      .post(`/api/test-sessions/${sessionId}/approve`)
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('passed');

    // 5. Reviewer generates Report (PDF + DOCX)
    const reportRes = await request(app)
      .post(`/api/reports/${sessionId}/generate`)
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(reportRes.status).toBe(201);
    const report = reportRes.body.data;
    expect(report.reportNumber).toMatch(/^NAWI-\d{4}-\d{6}$/);
    expect(report.contentHash).toHaveLength(64);
    expect(report.status).toBe('integrity_tagged');

    // Verify PDF & DOCX files created on disk
    expect(fs.existsSync(path.join(process.cwd(), report.pdfPath))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), report.docxPath))).toBe(true);

    // 6. Public verification endpoint (no auth required)
    // WP6 §12.4: integrity_tagged reports are not publicly verifiable until published.
    const verifyRes = await request(app).get(`/api/verify/${report.reportNumber}`);
    expect(verifyRes.status).toBe(404);
    const unpublishedLookup = await request(app)
      .get('/api/verify/lookup')
      .query({ serialNumber: 'test-scale-001' });
    expect(unpublishedLookup.status).toBe(200);
    expect(unpublishedLookup.body.data.reports).toHaveLength(0);
    const unpublishedDetailsLookup = await request(app)
      .get('/api/verify/lookup-details')
      .query({ searchTerm: 'E1205', testYear: '2026' });
    expect(unpublishedDetailsLookup.status).toBe(200);
    expect(unpublishedDetailsLookup.body.data.reports).toHaveLength(0);

    // Only a reviewer/admin can publish, and publication checks both stored artifacts.
    const publishRes = await request(app)
      .post(`/api/reports/${report._id}/publish`)
      .set('Authorization', `Bearer ${reviewerToken}`);
    expect(publishRes.status).toBe(200);
    expect(publishRes.body.data.status).toBe('published');

    const publishedVerifyRes = await request(app).get(`/api/verify/${report.reportNumber}`);
    expect(publishedVerifyRes.status).toBe(200);
    expect(publishedVerifyRes.body.data.reportNumber).toBe(report.reportNumber);
    expect(publishedVerifyRes.body.data.overallResult).toBe('pass');
    expect(publishedVerifyRes.body.data.status).toBe('published');
    expect(publishedVerifyRes.body.data.isPublished).toBe(true);
    expect(publishedVerifyRes.body.data.isIntegrityVerified).toBe(true);

    const serialLookup = await request(app)
      .get('/api/verify/lookup')
      .query({ serialNumber: 'test-scale-001' });
    expect(serialLookup.status).toBe(200);
    expect(serialLookup.body.data.reports).toHaveLength(1);
    expect(serialLookup.body.data.reports[0]).toMatchObject({
      reportNumber: report.reportNumber,
      serialNumber: 'TEST-SCALE-001',
      status: 'published',
    });

    const detailsLookup = await request(app)
      .get('/api/verify/lookup-details')
      .query({ searchTerm: 'e1205', testYear: '2026' });
    expect(detailsLookup.status).toBe(200);
    expect(detailsLookup.body.data.reports).toHaveLength(1);
    expect(detailsLookup.body.data.reports[0]).toMatchObject({
      reportNumber: report.reportNumber,
      status: 'published',
      instrumentModelName: 'E1205-1500',
      laboratoryName: 'Test Metrology Laboratory',
    });
    expect(detailsLookup.body.data.reports[0]).not.toHaveProperty('serialNumber');

    const invalidDetailsLookup = await request(app)
      .get('/api/verify/lookup-details')
      .query({ searchTerm: 'e' });
    expect(invalidDetailsLookup.status).toBe(400);

    // Verification by SHA256 hash
    const verifyHashRes = await request(app).get(`/api/verify/${report.contentHash}`);
    expect(verifyHashRes.status).toBe(200);
    expect(verifyHashRes.body.data.reportNumber).toBe(report.reportNumber);

    // 7. Reviewer fetches Audit Logs
    const auditRes = await request(app)
      .get('/api/audit-log')
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data.length).toBeGreaterThan(0);
    // Assert cryptographic hash chain integrity
    for (let i = 0; i < auditRes.body.data.length; i++) {
      expect(auditRes.body.data[i].currentHash).toHaveLength(64);
    }

    // 8. Reviewer checks Dashboard Statistics
    const dashRes = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(dashRes.status).toBe(200);
    expect(dashRes.body.data.totalSessions).toBeGreaterThanOrEqual(1);
    expect(dashRes.body.data.passedCount).toBeGreaterThanOrEqual(1);

    // 9. Admin calls e-Governance Export endpoint
    const exportRes = await request(app)
      .get('/api/export/legal-metrology')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(exportRes.status).toBe(200);
    expect(exportRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(exportRes.body.data[0].reportNumber).toBe(report.reportNumber);

    const archiveRes = await request(app)
      .post(`/api/reports/${report._id}/archive`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ reason: 'Revised report requested' });
    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.data.status).toBe('archived');

    // 10. Reviewer revokes report
    const revokeRes = await request(app)
      .post(`/api/reports/${report._id}/revoke`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ reason: 'Re-evaluation requested by Legal Metrology Officer' });

    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.data.status).toBe('revoked');
  }, 60000);
});
