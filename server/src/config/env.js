import dotenv from 'dotenv';
import crypto from 'node:crypto';
import path from 'node:path';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

if (process.env.NODE_ENV === 'test') {
  process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nawi_test';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_32_chars_long_minimum!';
}

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('[SECURITY] JWT_SECRET not provided; generated ephemeral 64-character secret.');
}

if (!process.env.MONGO_URI) {
  process.env.MONGO_URI = 'embedded';
  console.log('[CONFIG] MONGO_URI not provided; defaulting to embedded standalone database mode.');
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

if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 32 || insecureDefaults.has(process.env.CRON_SECRET.trim())) {
  process.env.CRON_SECRET = crypto.randomBytes(32).toString('hex');
}

if (!process.env.REPORT_INTEGRITY_SECRET || process.env.REPORT_INTEGRITY_SECRET.length < 32 || insecureDefaults.has(process.env.REPORT_INTEGRITY_SECRET.trim())) {
  process.env.REPORT_INTEGRITY_SECRET = crypto.randomBytes(32).toString('hex');
}

if (process.env.REQUIRE_EXTERNAL_SIGNER === 'true' || process.env.REPORT_SIGNING_SERVICE_URL) {
  const signerUrl = process.env.REPORT_SIGNING_SERVICE_URL;
  const signerToken = process.env.REPORT_SIGNING_SERVICE_TOKEN;
  const signerKeyId = process.env.REPORT_SIGNING_KEY_ID;
  const certificateBase64 = process.env.REPORT_SIGNING_CERTIFICATE_B64;
  const trustedFingerprints = (process.env.REPORT_SIGNING_TRUSTED_FINGERPRINTS || '').split(',').map((value) => value.trim());
  if (!signerUrl || !signerToken || !signerKeyId || !certificateBase64 || trustedFingerprints.filter(Boolean).length === 0) {
    console.error('FATAL ERROR: External PKI signer URL, token, key ID, certificate, and trusted certificate fingerprint(s) are required when external signer is enabled.');
    process.exit(1);
  }
  try {
    const parsedUrl = new URL(signerUrl);
    if (parsedUrl.protocol !== 'https:' && process.env.ALLOW_INSECURE_SIGNER !== 'true') throw new Error('HTTPS is required');
    const certificate = new crypto.X509Certificate(Buffer.from(certificateBase64, 'base64').toString('utf8'));
    const certificateFingerprint = certificate.fingerprint256.replace(/[^a-f0-9]/gi, '').toUpperCase();
    const trustSet = new Set(trustedFingerprints.map((value) => value.replace(/[^a-f0-9]/gi, '').toUpperCase()));
    if (!trustSet.has(certificateFingerprint)) throw new Error('Signing certificate fingerprint is not trusted');
  } catch (error) {
    console.error(`FATAL ERROR: REPORT_SIGNING_SERVICE configuration is invalid: ${error.message}`);
    process.exit(1);
  }
} else {
  console.log('[Metrology Engine] Running in HMAC-SHA256 report integrity mode.');
}

export const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  REPORT_INTEGRITY_SECRET: process.env.REPORT_INTEGRITY_SECRET || null,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  BCRYPT_SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || '*',
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '1000', 10),
  isVercel: process.env.VERCEL === '1',
};
