import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

export async function registerUser({ name, email, password, role, labId, manufacturerRef }) {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError(409, 'EMAIL_EXISTS', 'Email address is already registered');
  }

  if (role === 'manufacturer' && !manufacturerRef) {
    throw new AppError(400, 'MISSING_MANUFACTURER', 'Manufacturer reference is required for manufacturer accounts');
  }
  if (['lab_technician', 'reviewer', 'lab_admin'].includes(role) && !labId) {
    throw new AppError(400, 'MISSING_LAB_ID', 'Laboratory ID is required for laboratory accounts');
  }

  const saltRounds = env.BCRYPT_SALT_ROUNDS || 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const user = await User.create({
    name,
    email,
    passwordHash,
    role,
    labId: ['lab_technician', 'reviewer', 'lab_admin'].includes(role) ? labId : null,
    manufacturerRef: role === 'manufacturer' ? manufacturerRef : null,
    tokenVersion: 0,
  });

  await appendAuditLog({
    entityType: 'User',
    entityId: user._id,
    action: 'register',
    userId: user._id,
    details: { role: user.role },
  });

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    labId: user.labId,
    manufacturerRef: user.manufacturerRef,
  };
}

import { appendAuditLog } from './auditLogger.service.js';

export async function loginUser({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash +tokenVersion');
  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
  if (!user.active) throw new AppError(401, 'ACCOUNT_DISABLED', 'This account is disabled');

  // Account lockout check
  if (user.lockUntil) {
    if (user.lockUntil > new Date()) {
      const minutesRemaining = Math.ceil((user.lockUntil - new Date()) / 60000);
      throw new AppError(
        423,
        'ACCOUNT_LOCKED',
        `Account is locked due to repeated failed login attempts. Try again in ${minutesRemaining} minutes.`
      );
    } else {
      // Lock expired, reset counters
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      await user.save();
    }
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    const attempts = (user.failedLoginAttempts || 0) + 1;
    user.failedLoginAttempts = attempts;
    if (attempts >= 5) {
      user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minute lockout
    }
    await user.save();
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  // Reset lockout counters on success
  if (user.failedLoginAttempts > 0 || user.lockUntil) {
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();
  }

  const tokenPayload = {
    sub: user._id.toString(),
    role: user.role,
    labId: user.labId || null,
    manufacturerRef: user.manufacturerRef ? user.manufacturerRef.toString() : null,
    tokenVersion: user.tokenVersion || 0,
  };

  const token = jwt.sign(tokenPayload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

  return {
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      labId: user.labId,
      manufacturerRef: user.manufacturerRef,
    },
  };
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    throw new AppError(400, 'INVALID_CREDENTIALS', 'Current password is incorrect');
  }

  const saltRounds = env.BCRYPT_SALT_ROUNDS || 10;
  user.passwordHash = await bcrypt.hash(newPassword, saltRounds);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  await appendAuditLog({
    entityType: 'User',
    entityId: user._id,
    action: 'change_password',
    userId: user._id,
  });

  return { success: true, message: 'Password updated successfully' };
}
