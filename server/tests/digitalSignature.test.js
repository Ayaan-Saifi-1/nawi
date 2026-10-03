import { createServer } from 'node:http';
import crypto from 'node:crypto';
import { getCertificateFingerprint, signReportDigest, verifyDetachedSignature } from '../src/services/digitalSignature.service.js';

const privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCj6acSSM6eHDXa
zicjuWHQEmn1PE6Z7OUo6DGwo6sBvUUmjCfENF6l4A0W44llgTMhkFws4murgILD
NsCD0aVw+oLssbhQmDiMCN1MaL0dXpR7zxrQasBLjjuakaCwMYpgvo8YZpXHmTI0
WuMvZyFoIR9dA3JhQ+M+I+vpmPkzgtfJU5NhlyXcnDZJzpf0ecw6ywcX9UljC7HF
CInzHhLwmYRCUMg3Hotr895w0l5AqPtW4Y5sr9pZPs5QfiZtKKxm5AUCVeerDOOo
ZlbTZ200Npb6rlEnkUInY2xqGou0Cd6an3knXNjychzs3zmpwoV2QVoEZLVQKzEC
HWg8g85JAgMBAAECggEAMKnQ2UPWW+iiMIjd4+RI3t5oqM8zws0rJ97vybJ9tbF8
kzovIDgwFW0UVcRN6V3XUVKrmwPJ1Yv8xno946TdSlKFhkIpJ3xZ5XFISkQaSVro
GG3fVxsqZgQfO/+aRlUe8SQCFct3EmAwII0PP+aNa33R8upwDeJ619sQUjUBX0Iy
axIahFMQat+W/+XP1UXqkHbNyIsMdNgbXO82MozPL63hiNdIa3WWtHwqSpnUPvkv
YinzBxN3IMbrSR/I4Gx0sv0Q3cRBzWRydAovZEh5UacrqYlJ74zSeMtxM6GqCYK4
esIoelr6SvCp59Dzo0Uxmqrr8JDeE6wO0Op+oF52FQKBgQDawbq+fUKQI1Ica3DO
3e44g6B9/6L8BwT31POshgPdQzjy20DJzw8Cu1vUndddmmACVMwhBCs/DRcw6k+m
hI2QDqxYIXIjlUPhAHNoagvi2Og41WlsPxBx6AysDjYcEengmg1mXVAiucC8otC1
zVkpY8rMUD+la2+Nrvba5AqTjwKBgQC/0ZsnF7Oi0OgU2Wv1mQq0Rkx2+RNHdAs/
6s+hQug3OS9YESyvrVVUsQegsBlfFN2lAgN3GtTPcxK7x1IJiyVTYBoMErpGFUFw
v87IYYtA9sqsSkfwwHgM657hGzaUuKCDFMjsN/xBuoCoL+pJi5bHr9RlXtKfp8K5
Koe5ZdO0pwKBgAr6d/3BWYrUSvWkKrgnCSKK8I4CO1K8o3IwnL4Gx8Dd88i0Wi8G
ljFD59rmxP0sly7mxIvPor/6TzSkPbUUp+oX4mxV2V2RyyNKm4Ac+lW7HwRjKXRG
QfQFekVUPUDxYTRlZtDBVBk6C0MsRJ8rHBNor6/LQzZxCtsocbkQgrtfAoGBALy1
3rkv9TdZ5OkWGcMOZFyEyJdHZbMnNCYWwVv6MfCaXrx6cQcINOnUHBf3B47mPUQn
3fbgO7s3j5eTeV8QOJF0+0sjZYSrRq1A1pOGe3RXF382uN3ezHyRlcYKesEHfkpX
OXBDh/W2IPrV4N2n6ZfcoM114yrU5Zo7gDliN0wDAoGAEvgJV9L3kE5b78UkpYKg
cmKPDXpLVcYYgg9JM3Lv9z8rqkGresuofrZnBup+DWTGORJzDp72iVFaCFV+IXup
gLGlMs+sQ2mcyvDfwFV5OOyUSPwbtLtgN8zneJZAsiTQpsL74YTB8RsD7HIK50xs
z6B+O70KTA3pDJWlMRrjvQQ=
-----END PRIVATE KEY-----`;

const certificatePem = `-----BEGIN CERTIFICATE-----
MIIDFzCCAf+gAwIBAgIUe4UZTVgVtaULLx977s0fHocavMgwDQYJKoZIhvcNAQEL
BQAwGzEZMBcGA1UEAwwQTkFXSSBUZXN0IFNpZ25lcjAeFw0yNjA5MjgxOTAyNTJa
Fw0zNjA5MjUxOTAyNTJaMBsxGTAXBgNVBAMMEE5BV0kgVGVzdCBTaWduZXIwggEi
MA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCj6acSSM6eHDXazicjuWHQEmn1
PE6Z7OUo6DGwo6sBvUUmjCfENF6l4A0W44llgTMhkFws4murgILDNsCD0aVw+oLs
sbhQmDiMCN1MaL0dXpR7zxrQasBLjjuakaCwMYpgvo8YZpXHmTI0WuMvZyFoIR9d
A3JhQ+M+I+vpmPkzgtfJU5NhlyXcnDZJzpf0ecw6ywcX9UljC7HFCInzHhLwmYRC
UMg3Hotr895w0l5AqPtW4Y5sr9pZPs5QfiZtKKxm5AUCVeerDOOoZlbTZ200Npb6
rlEnkUInY2xqGou0Cd6an3knXNjychzs3zmpwoV2QVoEZLVQKzECHWg8g85JAgMB
AAGjUzBRMB0GA1UdDgQWBBSg8MJ9n1iqYhy2VFWy8+MuB3A/TjAfBgNVHSMEGDAW
gBSg8MJ9n1iqYhy2VFWy8+MuB3A/TjAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3
DQEBCwUAA4IBAQAkaVtMZDx9JFkVukk/pclQfG9+ZRn6nMyNMBq9X2hGgKnw53rq
UEV5okY8d7N/SrVbO9gSGFafSbj/PYAM7wlqJMfRBdVtsDhfxzXn1t6XO6J19uC4
Q0IFpZ+A2kV38QoQCnoOie4CgFmE0wm0EQ9nGs035dg/FLoEWJrqnQNf018A41WX
EJgY9qNd6vNuSLxEyVXxhTB6ouZymXKgNvMzTya1XbPJchogq4WLywjAmJLSEWSF
m/BOlqpV+WvQD2J+eiuqvxnyDGy310QBQxsB21HZ103xC1DtBXygqAw0gVVzR6HK
Ee2eUo63QaZKYVYGkKJunVtVS+dZ2JXTHOUJ
-----END CERTIFICATE-----`;

describe('External PKI report signer adapter', () => {
  const certificateFingerprint = getCertificateFingerprint(certificatePem);

  test('obtains an RSA signature from the isolated service and validates it against a pinned certificate', async () => {
    const server = createServer(async (request, response) => {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (request.headers.authorization !== 'Bearer unit-test-token') {
        response.writeHead(401).end();
        return;
      }
      const signature = crypto.sign('RSA-SHA256', Buffer.from(body.digest, 'hex'), privateKey).toString('base64');
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ signature, algorithm: 'RSA-SHA256', keyId: 'test-key', signedAt: new Date().toISOString() }));
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const digest = crypto.createHash('sha256').update('report bytes').digest('hex');
      const signed = await signReportDigest(digest, {
        serviceUrl: `http://127.0.0.1:${server.address().port}/sign`,
        serviceToken: 'unit-test-token',
        keyId: 'test-key',
        certificatePem,
        trustedFingerprints: [certificateFingerprint],
      });

      expect(signed.algorithm).toBe('RSA-SHA256');
      expect(signed.certificateFingerprint).toBe(certificateFingerprint);
      expect(verifyDetachedSignature(digest, signed.signature, signed.certificatePem, signed.signedAt, [certificateFingerprint])).toBe(true);
      expect(verifyDetachedSignature('0'.repeat(64), signed.signature, signed.certificatePem, signed.signedAt, [certificateFingerprint])).toBe(false);
      expect(verifyDetachedSignature(digest, signed.signature, signed.certificatePem, signed.signedAt, ['00'])).toBe(false);
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
