import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const signerRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = resolve(signerRoot, 'generated');
const privateKeyPath = resolve(outputDirectory, 'private-key.pem');
const certificatePath = resolve(outputDirectory, 'certificate.pem');

if (existsSync(privateKeyPath) || existsSync(certificatePath)) {
  throw new Error(`Refusing to overwrite existing key material in ${outputDirectory}. Move it elsewhere first.`);
}

mkdirSync(outputDirectory, { recursive: true, mode: 0o700 });
const result = spawnSync('openssl', [
  'req',
  '-x509',
  '-newkey',
  'rsa:3072',
  '-sha256',
  '-nodes',
  '-keyout',
  privateKeyPath,
  '-out',
  certificatePath,
  '-days',
  '3650',
  '-subj',
  '/CN=NAWI Demo Report Signer'
], { stdio: 'ignore', windowsHide: true });

if (result.error || result.status !== 0) {
  throw new Error(`OpenSSL could not create the demo certificate${result.error ? `: ${result.error.message}` : '.'}`);
}

chmodSync(privateKeyPath, 0o600);
const certificatePem = readFileSync(certificatePath, 'utf8');
const certificate = new crypto.X509Certificate(certificatePem);
const privateKeyBase64 = readFileSync(privateKeyPath).toString('base64');
const certificateBase64 = Buffer.from(certificatePem, 'utf8').toString('base64');
const serviceToken = crypto.randomBytes(48).toString('base64');
const keyId = `nawi-demo-${crypto.randomUUID()}`;

console.log('DEMO ONLY: these values are for a hackathon/demo, not legal or production report signing.');
console.log(`Generated key and certificate files in: ${outputDirectory}`);
console.log('Keep private-key.pem private. Never commit it or send it in chat.');
console.log('');
console.log('Set these on the signer Vercel project (Root Directory: signer):');
console.log(`SIGNER_TOKEN=${serviceToken}`);
console.log(`SIGNER_KEY_ID=${keyId}`);
console.log(`SIGNER_PRIVATE_KEY_B64=${privateKeyBase64}`);
console.log('');
console.log('Set these on the backend Vercel project:');
console.log('REPORT_SIGNING_SERVICE_URL=https://<signer-project>.vercel.app/api/sign');
console.log(`REPORT_SIGNING_SERVICE_TOKEN=${serviceToken}`);
console.log(`REPORT_SIGNING_KEY_ID=${keyId}`);
console.log(`REPORT_SIGNING_CERTIFICATE_B64=${certificateBase64}`);
console.log(`REPORT_SIGNING_TRUSTED_FINGERPRINTS=${certificate.fingerprint256}`);
