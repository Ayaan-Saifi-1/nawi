import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { registerUser } from '../services/auth.service.js';
import { appendAuditLog } from '../services/auditLogger.service.js';

export const getUsers = asyncHandler(async (req, res) => {
  const query = {};
  if (['lab_admin', 'reviewer'].includes(req.user.role)) {
    query.labId = req.user.labId || null;
  } else if (req.query.labId) {
    query.labId = req.query.labId;
  }

  if (req.query.role) {
    query.role = req.query.role;
  }

  const users = await User.find(query).select('-passwordHash').sort({ createdAt: -1 });
  res.status(200).json({
    success: true,
    data: users,
  });
});

export const updateUser = asyncHandler(async (req, res) => {
  const userToUpdate = await User.findById(req.params.id);
  if (!userToUpdate) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  if (req.user.role === 'lab_admin' && (!req.user.labId || userToUpdate.labId !== req.user.labId)) {
    throw new AppError(403, 'FORBIDDEN', 'Cannot manage users outside your assigned laboratory');
  }

  const { name, role, labId, active } = req.body;
  if (role && req.user.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Only a system administrator may change a user role');
  }
  if (name) userToUpdate.name = name;
  if (role) userToUpdate.role = role;
  if (labId && req.user.role === 'lab_admin' && labId !== req.user.labId) {
    throw new AppError(403, 'FORBIDDEN', 'A laboratory administrator cannot assign users to another laboratory');
  }
  if (labId) userToUpdate.labId = labId;
  if (active !== undefined) userToUpdate.active = Boolean(active);

  await userToUpdate.save();
  const result = userToUpdate.toObject();
  delete result.passwordHash;

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const userToDelete = await User.findById(req.params.id);
  if (!userToDelete) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  if (req.user.role === 'lab_admin' && (!req.user.labId || userToDelete.labId !== req.user.labId)) {
    throw new AppError(403, 'FORBIDDEN', 'Cannot manage users outside your assigned laboratory');
  }

  if (!userToDelete.active) {
    throw new AppError(409, 'ALREADY_ARCHIVED', 'User is already archived');
  }

  // Soft-delete: set active=false to preserve audit trail references
  userToDelete.active = false;
  await userToDelete.save();

  res.status(200).json({
    success: true,
    message: 'User archived successfully',
  });
});

// Lab administrators may only create technicians and reviewers inside their own laboratory (§4).
export function scopeUserCreation(req, res, next) {
  if (req.user.role === 'lab_admin') {
    if (!req.user.labId) return next(new AppError(403, 'FORBIDDEN', 'Your account has no laboratory assignment'));
    if (!['lab_technician', 'reviewer'].includes(req.body?.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'A laboratory administrator can only create lab technician or reviewer accounts'));
    }
    req.body = { ...req.body, labId: req.user.labId };
  }
  next();
}

export const createUser = asyncHandler(async (req, res) => {
  const user = await registerUser(req.body);
  await appendAuditLog({ entityType: 'User', entityId: user._id, action: 'create_by_admin', userId: req.user.sub, details: { role: user.role, labId: user.labId } });
  res.status(201).json({ success: true, data: user });
});