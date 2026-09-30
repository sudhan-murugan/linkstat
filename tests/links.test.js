const request = require('supertest');
const db = require('./helpers/db');
const { app, authHeader, createLink, waitFor } = require('./helpers/api');
const Link = require('../src/models/Link');
const Click = require('../src/models/Click');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

describe('URL shortening flow', () => {
  const originalUrl = 'https://example.com/a/very/long/path?utm_source=test';

  it('creates a short link and redirects its code to the original URL', async () => {
    const auth = await authHeader();
    const link = await createLink(auth, originalUrl);

    expect(link.shortCode).toMatch(/^[0-9A-Za-z]{7}$/);
    expect(link.shortUrl).toBe(`http://short.test/${link.shortCode}`);
    expect(link.originalUrl).toBe(originalUrl);

    // First hit reads MongoDB, second is served from the cache
    const first = await request(app).get(`/${link.shortCode}`).expect(302);
    expect(first.headers.location).toBe(originalUrl);
    expect(first.headers['x-cache']).toBe('MISS');

    const second = await request(app).get(`/${link.shortCode}`).expect(302);
    expect(second.headers.location).toBe(originalUrl);
    expect(second.headers['x-cache']).toBe('HIT');

    // Both visits are tracked
    await waitFor(async () => (await Click.countDocuments({ link: link.id })) === 2);
    await waitFor(async () => (await Link.findById(link.id)).clickCount === 2);
  });

  it('requires a JWT to create a link', async () => {
    await request(app).post('/api/links').send({ url: originalUrl }).expect(401);
  });

  it('rejects URLs that are not http(s)', async () => {
    const auth = await authHeader();
    const res = await request(app)
      .post('/api/links')
      .set('Authorization', auth)
      .send({ url: 'javascript:alert(1)' })
      .expect(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('returns 404 for an unknown short code', async () => {
    await request(app).get('/zzzzzzz').expect(404);
  });
});
