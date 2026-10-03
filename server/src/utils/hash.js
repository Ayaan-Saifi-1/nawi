import crypto from 'crypto';

export function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function signData(data, secret = process.env.REPORT_INTEGRITY_SECRET || process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production' && !process.env.REPORT_INTEGRITY_SECRET) {
    throw new Error('REPORT_INTEGRITY_SECRET must be configured separately in production');
  }
  if (!secret) throw new Error('REPORT_INTEGRITY_SECRET must be configured');
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

export function verifySignature(data, signature, secret = process.env.REPORT_INTEGRITY_SECRET || process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production' && !process.env.REPORT_INTEGRITY_SECRET) {
    throw new Error('REPORT_INTEGRITY_SECRET must be configured separately in production');
  }
  if (!secret) throw new Error('REPORT_INTEGRITY_SECRET must be configured');
  if (!/^[a-f0-9]{64}$/i.test(signature || '')) return false;
  const expected = signData(data, secret);
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
}
