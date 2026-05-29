import { encryptToken, decryptToken, buildOAuthUrl, parseStateJwt } from '../src/services/ms-auth.js';

// Set env vars before tests
process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64); // 32 bytes as hex
process.env.AZURE_CLIENT_ID = 'test-client-id';
process.env.AZURE_TENANT_ID = 'common';
process.env.MS_REDIRECT_URI = 'http://localhost:3001/api/ms-auth/callback';
process.env.JWT_SECRET = 'test-jwt-secret';

describe('encryptToken / decryptToken', () => {
  it('round-trips a token string', () => {
    const original = 'my-secret-token-value';
    const encrypted = encryptToken(original);
    expect(encrypted).not.toBe(original);
    expect(encrypted).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(original);
  });

  it('produces different ciphertext each call (random IV)', () => {
    const a = encryptToken('same');
    const b = encryptToken('same');
    expect(a).not.toBe(b);
  });
});

describe('buildOAuthUrl', () => {
  it('returns a Microsoft login URL with required params', () => {
    const url = buildOAuthUrl('provider-123', 'user-456');
    expect(url).toContain('login.microsoftonline.com');
    expect(url).toContain('client_id=test-client-id');
    expect(url).toContain('response_type=code');
    expect(url).toContain('Files.ReadWrite');
    expect(url).toContain('state=');
  });
});

describe('parseStateJwt', () => {
  it('returns providerId and userId from a valid state token', () => {
    const url = buildOAuthUrl('provider-abc', 'user-xyz');
    const state = new URL(url).searchParams.get('state');
    const result = parseStateJwt(state);
    expect(result.providerId).toBe('provider-abc');
    expect(result.userId).toBe('user-xyz');
  });

  it('throws on an invalid token', () => {
    expect(() => parseStateJwt('bad.token.here')).toThrow();
  });
});
