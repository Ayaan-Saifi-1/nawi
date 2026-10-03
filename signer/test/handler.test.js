import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { handleSignRequest } from '../src/handler.js';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' }
});
const token = 'signer-test-token-value-with-more-than-32-characters';
const keyId = 'test-key';

function invoke({ method = 'POST', authorization = `Bearer ${token}`, body = {} } = {}) {
  let statusCode;
  let responseBody;
  let allowHeader;
  const response = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      responseBody = value;
      return this;
    },
    setHeader(name, value) {
      if (name === 'Allow') allowHeader = value;
    }
  };

  handleSignRequest({ method, headers: { authorization }, body }, response);
  return { statusCode, responseBody, allowHeader };
}

test('signs a valid SHA-256 digest and returns the expected metadata', () => {
  const previous = {
    token: process.env.SIGNER_TOKEN,
    keyId: process.env.SIGNER_KEY_ID,
    privateKey: process.env.SIGNER_PRIVATE_KEY_B64
  };
  process.env.SIGNER_TOKEN = token;
  process.env.SIGNER_KEY_ID = keyId;
  process.env.SIGNER_PRIVATE_KEY_B64 = Buffer.from(privateKey).toString('base64');

  try {
    const digest = crypto.createHash('sha256').update('report bytes').digest('hex');
    const result = invoke({ body: { digest, algorithm: 'RSA-SHA256', keyId } });
    assert.equal(result.statusCode, 200);
    assert.equal(result.responseBody.algorithm, 'RSA-SHA256');
    assert.equal(result.responseBody.keyId, keyId);
    assert.ok(!Number.isNaN(new Date(result.responseBody.signedAt).getTime()));
    assert.equal(
      crypto.verify('RSA-SHA256', Buffer.from(digest, 'hex'), publicKey, Buffer.from(result.responseBody.signature, 'base64')),
      true
    );
  } finally {
    if (previous.token === undefined) delete process.env.SIGNER_TOKEN;
    else process.env.SIGNER_TOKEN = previous.token;
    if (previous.keyId === undefined) delete process.env.SIGNER_KEY_ID;
    else process.env.SIGNER_KEY_ID = previous.keyId;
    if (previous.privateKey === undefined) delete process.env.SIGNER_PRIVATE_KEY_B64;
    else process.env.SIGNER_PRIVATE_KEY_B64 = previous.privateKey;
  }
});

test('rejects unauthorized, malformed, and unsupported requests', () => {
  const previous = {
    token: process.env.SIGNER_TOKEN,
    keyId: process.env.SIGNER_KEY_ID,
    privateKey: process.env.SIGNER_PRIVATE_KEY_B64
  };
  process.env.SIGNER_TOKEN = token;
  process.env.SIGNER_KEY_ID = keyId;
  process.env.SIGNER_PRIVATE_KEY_B64 = Buffer.from(privateKey).toString('base64');

  try {
    assert.equal(invoke({ authorization: 'Bearer wrong' }).statusCode, 401);
    assert.equal(invoke({ body: { digest: 'bad', algorithm: 'RSA-SHA256', keyId } }).statusCode, 400);
    assert.equal(invoke({ body: { digest: 'a'.repeat(64), algorithm: 'RSA-SHA256', keyId: 'wrong' } }).statusCode, 400);
    const getResponse = invoke({ method: 'GET' });
    assert.equal(getResponse.statusCode, 405);
    assert.equal(getResponse.allowHeader, 'POST');
  } finally {
    if (previous.token === undefined) delete process.env.SIGNER_TOKEN;
    else process.env.SIGNER_TOKEN = previous.token;
    if (previous.keyId === undefined) delete process.env.SIGNER_KEY_ID;
    else process.env.SIGNER_KEY_ID = previous.keyId;
    if (previous.privateKey === undefined) delete process.env.SIGNER_PRIVATE_KEY_B64;
    else process.env.SIGNER_PRIVATE_KEY_B64 = previous.privateKey;
  }
});
