import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { appendAuditLog } from '../services/auditLogger.service.js';

dotenv.config();

export async function bootstrapAdmin() {
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const confirmation = process.env.BOOTSTRAP_ADMIN_CONFIRM;
  const mongoUri = process.env.MONGO_URI;

  if (confirmation !== 'CREATE_FIRST_ADMIN') {
    throw new Error('Set BOOTSTRAP_ADMIN_CONFIRM=CREATE_FIRST_ADMIN to confirm one-time admin creation');
  }
  if (!mongoUri || !name || !email || !password) {
    throw new Error('MONGO_URI and BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL, and BOOTSTRAP_ADMIN_PASSWORD are required');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL must be a valid email address');
  }
  if (password.length < 12 || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/.test(password)) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters and include uppercase, lowercase, number, and special characters');
  }

  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS || 12);
  if (!Number.isInteger(saltRounds) || saltRounds < 10 || saltRounds > 14) {
    throw new Error('BCRYPT_SALT_ROUNDS must be an integer between 10 and 14');
  }

  await mongoose.connect(mongoUri);
  const existingUserCount = await User.countDocuments();
  if (existingUserCount > 0) {
    throw new Error('Bootstrap refused: the database already contains users');
  }

  const user = await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, saltRounds),
    role: 'admin',
  });

  await appendAuditLog({
    entityType: 'User',
    entityId: user._id,
    action: 'bootstrap_first_admin',
    userId: user._id,
  });

  console.log(`Created the initial administrator account: ${email}`);
}

if (process.argv[1]?.endsWith('bootstrapAdmin.js')) {
  bootstrapAdmin()
    .catch((error) => {
      console.error(`Admin bootstrap failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    });
}
