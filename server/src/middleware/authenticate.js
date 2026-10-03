import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { User } from '../models/User.js';

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError(401, 'NO_TOKEN', 'Authorization token missing or malformed'));
  }

  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch (err) {
    return next(new AppError(401, 'INVALID_TOKEN', 'Invalid or expired token'));
  }
  User.findById(decoded.sub).select('active role labId email name tokenVersion manufacturerRef').then((user) => {
    if (!user || !user.active) return next(new AppError(401, 'ACCOUNT_DISABLED', 'Account is unavailable'));
    if (decoded.tokenVersion !== undefined && user.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
      return next(new AppError(401, 'TOKEN_EXPIRED', 'Session has expired due to password change or account update'));
    }
    // Use live DB values for role, labId, manufacturerRef and email — not the potentially stale JWT claims
    req.user = {
      ...decoded,
      _id: user._id.toString(),
      role: user.role,
      labId: user.labId,
      email: user.email,
      name: user.name,
      manufacturerRef: user.manufacturerRef ? user.manufacturerRef.toString() : null,
    };
    return next();
  }).catch(next);
}

