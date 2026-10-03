import mongoose from 'mongoose';
import { TestType } from '../models/TestType.js';
import { User } from '../models/User.js';

export const initialTestTypes = [
  {
    testTypeId: 'T-A4-ACC',
    testName: 'Accuracy',
    oimlAnnexRef: 'A4_accuracy',
    formulaRef: 'Ec = I - L - E0; pass when |Ec| ≤ applicable MPE',
    description: 'Compare corrected indication error at each test load with the OIML MPE for the instrument class, load band, and verification stage.',
    mandatoryFor: [
      { accuracyClass: 'I', verificationStage: 'all' },
      { accuracyClass: 'II', verificationStage: 'all' },
      { accuracyClass: 'III', verificationStage: 'all' },
      { accuracyClass: 'IIII', verificationStage: 'all' }
    ],
    status: 'approved'
  },
  {
    testTypeId: 'T-A4-ECC',
    testName: 'Eccentricity',
    oimlAnnexRef: 'A4_eccentricity',
    formulaRef: 'Ec = I - L - E0; each position must meet applicable MPE',
    description: 'Compare the corrected indication error at every eccentric load position with the OIML MPE for the applied load, instrument class, and verification stage.',
    mandatoryFor: [
      { accuracyClass: 'I', verificationStage: 'all' },
      { accuracyClass: 'II', verificationStage: 'all' },
      { accuracyClass: 'III', verificationStage: 'all' },
      { accuracyClass: 'IIII', verificationStage: 'all' }
    ],
    status: 'approved'
  },
  {
    testTypeId: 'T-A4-REP',
    testName: 'Repeatability',
    oimlAnnexRef: 'A4_repeatability',
    formulaRef: 'R = Imax - Imin; pass when R ≤ |MPE(load)|',
    description: 'For repeated weighings of the same load, compare the indication range with the absolute OIML MPE for that load; each individual result must also meet MPE.',
    mandatoryFor: [
      { accuracyClass: 'I', verificationStage: 'all' },
      { accuracyClass: 'II', verificationStage: 'all' },
      { accuracyClass: 'III', verificationStage: 'all' },
      { accuracyClass: 'IIII', verificationStage: 'all' }
    ],
    status: 'approved'
  },
  {
    testTypeId: 'T-A4-DISC',
    testName: 'Discrimination',
    oimlAnnexRef: 'A4_discrimination',
    formulaRef: 'Additional load response: ΔL ≥ 1.4d (digital instruments, as applicable)',
    description: 'Verify the prescribed response to a small additional load at the applicable test loads.',
    mandatoryFor: [
      { accuracyClass: 'I', verificationStage: 'all' },
      { accuracyClass: 'II', verificationStage: 'all' },
      { accuracyClass: 'III', verificationStage: 'all' },
      { accuracyClass: 'IIII', verificationStage: 'all' }
    ],
    status: 'approved'
  },
  {
    testTypeId: 'T-A1-ADMIN',
    testName: 'Administrative Examination',
    oimlAnnexRef: 'A1_administrative',
    formulaRef: 'Manual / Checklist',
    description: 'Verification of descriptive markings and conformity',
    mandatoryFor: [
      { accuracyClass: 'I', verificationStage: 'all' },
      { accuracyClass: 'II', verificationStage: 'all' },
      { accuracyClass: 'III', verificationStage: 'all' },
      { accuracyClass: 'IIII', verificationStage: 'all' }
    ],
    status: 'approved'
  },
  {
    testTypeId: 'T-B-ELEC',
    testName: 'Electronic Additional',
    oimlAnnexRef: 'B_electronic_additional',
    formulaRef: 'Manual / Checklist',
    description: 'Additional tests for electronic instruments',
    mandatoryFor: [],
    status: 'approved'
  }
];

export async function seedTestTypes() {
  console.log('Seeding TestTypes...');
  const adminUser = await User.findOne({ email: 'admin@nawi.gov.in' });
  const adminId = adminUser ? adminUser._id : null;

  for (const type of initialTestTypes) {
    const data = { ...type, createdBy: adminId, approvedBy: adminId, approvedAt: new Date() };
    await TestType.findOneAndUpdate(
      { testTypeId: type.testTypeId },
      data,
      { upsert: true, new: true }
    );
  }
  console.log('TestTypes seeded successfully.');
}
