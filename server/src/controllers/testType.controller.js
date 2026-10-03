import { TestType } from '../models/TestType.js';
import { asyncHandler } from '../utils/asyncHandler.js';

import { AppError } from '../utils/AppError.js';
import { appendAuditLog } from '../services/auditLogger.service.js';

export const getTestTypes = asyncHandler(async (req, res) => {
  const types = await TestType.find().sort({ testTypeId: 1 });
  res.status(200).json({
    success: true,
    data: types,
  });
});

export const createTestType = asyncHandler(async (req, res) => {
  const data = req.body;
  const existing = await TestType.findOne({ testTypeId: data.testTypeId });
  if (existing) {
    throw new AppError(409, 'CONFLICT', 'TestType with this ID already exists');
  }

  const testType = await TestType.create({
    ...data,
    status: 'draft',
    createdBy: req.user.sub,
  });

  await appendAuditLog({
    entityType: 'TestType',
    entityId: testType._id,
    action: 'create',
    userId: req.user.sub,
    details: { testTypeId: testType.testTypeId },
  });

  res.status(201).json({ success: true, data: testType });
});

export const updateTestType = asyncHandler(async (req, res) => {
  const testType = await TestType.findById(req.params.id);
  if (!testType) {
    throw new AppError(404, 'NOT_FOUND', 'TestType not found');
  }

  if (testType.status === 'approved') {
    throw new AppError(400, 'INVALID_STATE', 'Approved TestType cannot be directly modified. Create a new revision (not implemented) or change status to draft.');
  }

  const allowedFields = ['testName', 'oimlAnnexRef', 'formulaRef', 'description', 'mandatoryFor', 'isActive'];
  const before = {};
  allowedFields.forEach((field) => {
    before[field] = testType[field];
    if (req.body[field] !== undefined) {
      testType[field] = req.body[field];
    }
  });

  await testType.save();

  await appendAuditLog({
    entityType: 'TestType',
    entityId: testType._id,
    action: 'update',
    userId: req.user.sub,
    details: { before },
  });

  res.status(200).json({ success: true, data: testType });
});

export const approveTestType = asyncHandler(async (req, res) => {
  const testType = await TestType.findById(req.params.id);
  if (!testType) {
    throw new AppError(404, 'NOT_FOUND', 'TestType not found');
  }

  if (testType.status === 'approved') {
    throw new AppError(400, 'INVALID_STATE', 'TestType is already approved');
  }

  if (testType.createdBy?.toString() === req.user.sub) {
    throw new AppError(403, 'FORBIDDEN', 'Approver cannot be the same as the creator');
  }

  testType.status = 'approved';
  testType.approvedBy = req.user.sub;
  testType.approvedAt = new Date();
  await testType.save();

  await appendAuditLog({
    entityType: 'TestType',
    entityId: testType._id,
    action: 'approve',
    userId: req.user.sub,
  });

  res.status(200).json({ success: true, data: testType });
});
