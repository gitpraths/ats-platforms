import request from 'supertest';
import app from '../src/app.js';

async function loginAsAdmin() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@myats.dev', password: 'password123' });
  return res.body.data.token;
}

const SEED_PROVIDER_ID = '00000000-0000-0000-0005-000000000001';

describe('GET /api/providers/:id/ms-auth/url', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/providers/some-id/ms-auth/url');
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown provider', async () => {
    const token = await loginAsAdmin();
    const res = await request(app)
      .get('/api/providers/00000000-0000-0000-0000-000000000000/ms-auth/url')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns a Microsoft OAuth URL for a known provider', async () => {
    const token = await loginAsAdmin();
    const res = await request(app)
      .get(`/api/providers/${SEED_PROVIDER_ID}/ms-auth/url`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.url).toContain('login.microsoftonline.com');
  });
});

describe('GET /api/ms-auth/callback', () => {
  it('returns 400 when state is missing', async () => {
    const res = await request(app).get('/api/ms-auth/callback?code=abc');
    expect(res.status).toBe(400);
  });

  it('returns 400 when state JWT is invalid', async () => {
    const res = await request(app).get('/api/ms-auth/callback?code=abc&state=bad.token.here');
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/providers/:id/ms-auth', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).delete('/api/providers/some-id/ms-auth');
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown provider', async () => {
    const token = await loginAsAdmin();
    const res = await request(app)
      .delete('/api/providers/00000000-0000-0000-0000-000000000000/ms-auth')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
