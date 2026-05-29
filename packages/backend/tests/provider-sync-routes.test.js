import request from 'supertest';
import app from '../src/app.js';

async function loginAsAdmin() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@myats.dev', password: 'password123' });
  return res.body.data.token;
}

const SEED_PROVIDER_ID = '00000000-0000-0000-0005-000000000001';

describe('PATCH /api/providers/:id/spreadsheet', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).patch(`/api/providers/${SEED_PROVIDER_ID}/spreadsheet`);
    expect(res.status).toBe(401);
  });

  it('returns 400 when onedrive_url is missing', async () => {
    const token = await loginAsAdmin();
    const res = await request(app)
      .patch(`/api/providers/${SEED_PROVIDER_ID}/spreadsheet`)
      .set('Authorization', `Bearer ${token}`)
      .send({ onedrive_sheet_name: 'Sheet1' });
    expect(res.status).toBe(400);
  });

  it('returns 409 when provider has no OAuth tokens connected', async () => {
    const token = await loginAsAdmin();
    const res = await request(app)
      .patch(`/api/providers/${SEED_PROVIDER_ID}/spreadsheet`)
      .set('Authorization', `Bearer ${token}`)
      .send({ onedrive_url: 'https://onedrive.live.com/some-url', onedrive_sheet_name: 'Sheet1' });
    expect(res.status).toBe(409);
  });
});

describe('GET /api/providers/:id/sync-logs', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get(`/api/providers/${SEED_PROVIDER_ID}/sync-logs`);
    expect(res.status).toBe(401);
  });

  it('returns empty array for provider with no sync history', async () => {
    const token = await loginAsAdmin();
    const res = await request(app)
      .get(`/api/providers/${SEED_PROVIDER_ID}/sync-logs`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('POST /api/providers/:id/sync', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post(`/api/providers/${SEED_PROVIDER_ID}/sync`);
    expect(res.status).toBe(401);
  });

  it('returns 409 when provider has no spreadsheet connected', async () => {
    const token = await loginAsAdmin();
    const res = await request(app)
      .post(`/api/providers/${SEED_PROVIDER_ID}/sync`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
  });
});
