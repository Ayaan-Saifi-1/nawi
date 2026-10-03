import { setupTestDB, teardownTestDB } from './testHelper.js';
import { RuleConfig } from '../src/models/RuleConfig.js';
import { resolveRuleConfig } from '../src/services/ruleResolver.service.js';
import mongoose from 'mongoose';

const reviewFields = () => ({
  status: 'active',
  sourceReference: 'Unit-test fixture only',
  validationNote: 'Synthetic known-answer rule used only by the resolver tests',
  createdBy: new mongoose.Types.ObjectId(),
  approvedBy: new mongoose.Types.ObjectId(),
  approvedAt: new Date(),
});

describe('Rule Resolver Service', () => {
  beforeAll(async () => {
    await setupTestDB();
  }, 120000);

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await RuleConfig.deleteMany({});
  });

  test('resolveRuleConfig picks the version effective at testDate, not the newest', async () => {
    const v2006 = await RuleConfig.create({
      ...reviewFields(),
      oimlEdition: 'R76-1:2006',
      accuracyClass: 'III',
      effectiveDate: new Date('2006-01-01'),
      bands: [{ uptoMultipleOfE: 500, mpeFactor: 0.5 }],
    });

    const v2020 = await RuleConfig.create({
      ...reviewFields(),
      oimlEdition: 'R76-1:2020-Update',
      accuracyClass: 'III',
      effectiveDate: new Date('2020-01-01'),
      bands: [{ uptoMultipleOfE: 500, mpeFactor: 0.4 }],
    });

    // Query for a test date in 2015 (should resolve 2006 edition)
    const resolved2015 = await resolveRuleConfig('III', new Date('2015-06-15'));
    expect(resolved2015._id.toString()).toBe(v2006._id.toString());
    expect(resolved2015.oimlEdition).toBe('R76-1:2006');

    // Query for a test date in 2022 (should resolve 2020 edition)
    const resolved2022 = await resolveRuleConfig('III', new Date('2022-03-10'));
    expect(resolved2022._id.toString()).toBe(v2020._id.toString());
    expect(resolved2022.oimlEdition).toBe('R76-1:2020-Update');
  });

  test('throws AppError if no rule configuration is effective on or before testDate', async () => {
    await RuleConfig.create({
      ...reviewFields(),
      oimlEdition: 'R76-1:2006',
      accuracyClass: 'III',
      effectiveDate: new Date('2006-01-01'),
      bands: [{ uptoMultipleOfE: 500, mpeFactor: 0.5 }],
    });

    await expect(
      resolveRuleConfig('III', new Date('2000-01-01'))
    ).rejects.toThrow('No rule configuration for class III effective on or before');
  });

  test('a reviewed scheduled rule resolves only on or after its effective date', async () => {
    const active = await RuleConfig.create({
      ...reviewFields(),
      oimlEdition: 'Baseline fixture',
      accuracyClass: 'III',
      effectiveDate: new Date('2020-01-01'),
      bands: [{ uptoMultipleOfE: 500, mpeFactor: 0.5 }],
    });
    const scheduled = await RuleConfig.create({
      ...reviewFields(),
      status: 'scheduled',
      oimlEdition: 'Scheduled fixture',
      accuracyClass: 'III',
      effectiveDate: new Date('2030-01-01'),
      bands: [{ uptoMultipleOfE: 500, mpeFactor: 0.4 }],
    });

    const beforeEffectiveDate = await resolveRuleConfig('III', new Date('2029-12-31'));
    const onEffectiveDate = await resolveRuleConfig('III', new Date('2030-01-01'));
    expect(beforeEffectiveDate._id.toString()).toBe(active._id.toString());
    expect(onEffectiveDate._id.toString()).toBe(scheduled._id.toString());
  });
});
