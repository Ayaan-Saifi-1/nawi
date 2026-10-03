import crypto from 'node:crypto';

function loadSignerConfig() {
  const token = process.env.SIGNER_TOKEN;
  const keyId = process.env.SIGNER_KEY_ID;
  const privateKeyBase64 = process.env.SIGNER_PRIVATE_KEY_B64;

  if (!token || Buffer.byteLength(token) < 32 || !keyId || !privateKeyBase64) {
    throw new Error('Missing or invalid signer environment configuration');
  }

  const privateKeyPem = Buffer.from(privateKeyBase64, 'base64').toString('utf8');
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  if (privateKey.asymmetricKeyType !== 'rsa' || (privateKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) {
    throw new Error('Signer private key must be RSA with at least 2048 bits');
  }

  return { token, keyId, privateKey };
}

function respond(response, status, body) {
  return response.status(status).json(body);
}

export function handleSignRequest(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return respond(response, 405, { error: 'Method not allowed' });
  }

  let config;
  try {
    config = loadSignerConfig();
  } catch (error) {
    console.error(`Signer configuration error: ${error.message}`);
    return respond(response, 500, { error: 'Signer is not configured correctly' });
  }

  const authorization = request.headers?.authorization || '';
  const expectedAuthorization = `Bearer ${config.token}`;
  const providedBytes = Buffer.from(authorization);
  const expectedBytes = Buffer.from(expectedAuthorization);
  if (providedBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(providedBytes, expectedBytes)) {
    return respond(response, 401, { error: 'Unauthorized' });
  }

  const { digest, algorithm, keyId } = request.body || {};
  if (
    typeof digest !== 'string' ||
    !/^[a-f0-9]{64}$/i.test(digest) ||
    algorithm !== 'RSA-SHA256' ||
    keyId !== config.keyId
  ) {
    return respond(response, 400, { error: 'Invalid signing request' });
  }

  try {
    const signature = crypto.sign('RSA-SHA256', Buffer.from(digest, 'hex'), config.privateKey).toString('base64');
    return respond(response, 200, {
      signature,
      algorithm: 'RSA-SHA256',
      keyId: config.keyId,
      signedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Signing operation failed: ${error.message}`);
    return respond(response, 500, { error: 'Signing operation failed' });
  }
}
