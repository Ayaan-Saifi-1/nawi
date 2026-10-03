import crypto from 'node:crypto';
import { verifySignature as verifyHmac } from '../utils/hash.js';

function normalizeFingerprint(value) {
  return String(value || '').replace(/[^a-f0-9]/gi, '').toUpperCase();
}

export function getCertificateFingerprint(certificatePem) {
  return new crypto.X509Certificate(certificatePem).fingerprint256;
}

export function verifyDetachedSignature(digest, signature, certificatePem, signedAt, trustedFingerprints) {
  if (!/^[a-f0-9]{64}$/i.test(digest || '') || !signature || !certificatePem) return false;
  try {
    const certificate = new crypto.X509Certificate(certificatePem);
    const signedAtDate = new Date(signedAt);
    if (Number.isNaN(signedAtDate.getTime())) return false;
    if (signedAtDate < new Date(certificate.validFrom) || signedAtDate > new Date(certificate.validTo)) return false;

    const trusted = new Set((trustedFingerprints || []).map(normalizeFingerprint).filter(Boolean));
    if (!trusted.has(normalizeFingerprint(certificate.fingerprint256))) return false;

    const signatureBytes = Buffer.from(signature, 'base64');
    if (!signatureBytes.length || signatureBytes.toString('base64') !== signature) return false;
    return crypto.verify('RSA-SHA256', Buffer.from(digest, 'hex'), certificate.publicKey, signatureBytes);
  } catch {
    return false;
  }
}

function getDefaultConfig() {
  return {
    serviceUrl: process.env.REPORT_SIGNING_SERVICE_URL,
    serviceToken: process.env.REPORT_SIGNING_SERVICE_TOKEN,
    keyId: process.env.REPORT_SIGNING_KEY_ID,
    certificatePem: process.env.REPORT_SIGNING_CERTIFICATE_B64
      ? Buffer.from(process.env.REPORT_SIGNING_CERTIFICATE_B64, 'base64').toString('utf8')
      : process.env.REPORT_SIGNING_CERTIFICATE,
    trustedFingerprints: (process.env.REPORT_SIGNING_TRUSTED_FINGERPRINTS || '').split(',').map((value) => value.trim()).filter(Boolean),
  };
}

export async function signReportDigest(digest, config = getDefaultConfig()) {
  if (!/^[a-f0-9]{64}$/i.test(digest || '')) throw new Error('A SHA-256 digest is required for report signing');
  const isConfigured = config.serviceUrl && config.serviceToken && config.keyId && config.certificatePem;
  if (!isConfigured) {
    if (process.env.NODE_ENV === 'production') throw new Error('An external PKI signing service and certificate are required in production');
    return null;
  }

  const endpoint = new URL(config.serviceUrl);
  if (process.env.NODE_ENV === 'production' && endpoint.protocol !== 'https:') {
    throw new Error('The external PKI signing service must use HTTPS in production');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.serviceToken}`,
    },
    body: JSON.stringify({ digest: digest.toLowerCase(), algorithm: 'RSA-SHA256', keyId: config.keyId }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`PKI signing service returned HTTP ${response.status}`);

  const result = await response.json();
  const signedAt = new Date(result.signedAt);
  if (result.algorithm !== 'RSA-SHA256' || result.keyId !== config.keyId || Number.isNaN(signedAt.getTime())) {
    throw new Error('PKI signing service returned invalid signing metadata');
  }
  const certificateFingerprint = getCertificateFingerprint(config.certificatePem);
  if (!verifyDetachedSignature(digest, result.signature, config.certificatePem, signedAt, config.trustedFingerprints)) {
    throw new Error('PKI signing response failed certificate trust or signature verification');
  }

  return {
    signature: result.signature,
    algorithm: 'RSA-SHA256',
    certificatePem: config.certificatePem,
    certificateFingerprint,
    keyId: config.keyId,
    signedAt,
  };
}

export function verifyReportArtifact(digest, report, format) {
  const upperFormat = String(format).toUpperCase();
  const pkiSignature = upperFormat === 'PDF' ? report?.pdfSignature : report?.docxSignature;
  const signedAt = upperFormat === 'PDF' ? report?.pdfSignedAt : report?.docxSignedAt;
  if (pkiSignature) {
    const trustedFingerprints = (process.env.REPORT_SIGNING_TRUSTED_FINGERPRINTS || '').split(',').map((value) => value.trim()).filter(Boolean);
    return verifyDetachedSignature(digest, pkiSignature, report.signatureCertificate, signedAt, trustedFingerprints);
  }

  const legacyHmac = upperFormat === 'PDF' ? report?.hmacTag : report?.docxHmacTag;
  return verifyHmac(digest, legacyHmac);
}
