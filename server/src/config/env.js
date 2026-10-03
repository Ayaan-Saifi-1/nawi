import dotenv from 'dotenv';
import crypto from 'node:crypto';

dotenv.config();

if (process.env.NODE_ENV === 'test') {
  process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nawi_test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_32_chars_long_minimum!';
}

const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`FATAL ERROR: Environment variable ${envVar} is missing.`);
    process.exit(1);
  }
}

const insecureDefaults = new Set([
  'supersecretkey',
  'integritysecret',
  'example_secret',
  'your_jwt_secret_key_min_32_chars',
  'change_this_secret',
  'secret',
  '12345678901234567890123456789012',
]);

if (process.env.NODE_ENV === 'production') {
  if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 32 || insecureDefaults.has(process.env.CRON_SECRET.trim())) {
    console.error('FATAL ERROR: CRON_SECRET must be at least 32 characters and cannot use default example values in production.');
    process.exit(1);
  }
  if (process.env.ENABLE_DEMO === 'true') {
    console.error('FATAL ERROR: ENABLE_DEMO cannot be enabled in production.');
    process.exit(1);
  }
  if (!process.env.REPORT_INTEGRITY_SECRET) {
    console.error('FATAL ERROR: REPORT_INTEGRITY_SECRET is required in production.');
    process.exit(1);
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || insecureDefaults.has(process.env.JWT_SECRET.trim())) {
    console.error('FATAL ERROR: JWT_SECRET must be at least 32 characters and cannot use default example values in production.');
    process.exit(1);
  }
  if (process.env.REPORT_INTEGRITY_SECRET.length < 32 || insecureDefaults.has(process.env.REPORT_INTEGRITY_SECRET.trim())) {
    console.error('FATAL ERROR: REPORT_INTEGRITY_SECRET must be at least 32 characters and cannot use default example values in production.');
    process.exit(1);
  }
  const signerUrl = process.env.REPORT_SIGNING_SERVICE_URL;
  const signerToken = process.env.REPORT_SIGNING_SERVICE_TOKEN;
  const signerKeyId = process.env.REPORT_SIGNING_KEY_ID;
  const certificateBase64 = process.env.REPORT_SIGNING_CERTIFICATE_B64;
  const trustedFingerprints = (process.env.REPORT_SIGNING_TRUSTED_FINGERPRINTS || '').split(',').map((value) => value.trim());
  if (!signerUrl || !signerToken || !signerKeyId || !certificateBase64 || trustedFingerprints.filter(Boolean).length === 0) {
    console.error('FATAL ERROR: External PKI signer URL, token, key ID, certificate, and trusted certificate fingerprint(s) are required in production.');
    process.exit(1);
  }
  try {
    const parsedUrl = new URL(signerUrl);
    if (parsedUrl.protocol !== 'https:') throw new Error('HTTPS is required');
    const certificate = new crypto.X509Certificate(Buffer.from(certificateBase64, 'base64').toString('utf8'));
    const certificateFingerprint = certificate.fingerprint256.replace(/[^a-f0-9]/gi, '').toUpperCase();
    const trustSet = new Set(trustedFingerprints.map((value) => value.replace(/[^a-f0-9]/gi, '').toUpperCase()));
    if (!trustSet.has(certificateFingerprint)) throw new Error('Signing certificate fingerprint is not trusted');
  } catch (error) {
    console.error(`FATAL ERROR: REPORT_SIGNING_SERVICE configuration is invalid: ${error.message}`);
    process.exit(1);
  }
}

export const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  REPORT_INTEGRITY_SECRET: process.env.REPORT_INTEGRITY_SECRET || null,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '200', 10),
  isVercel: process.env.VERCEL === '1',
};
