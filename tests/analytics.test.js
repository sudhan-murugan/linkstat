const request = require('supertest');
const db = require('./helpers/db');
const { app, authHeader, createLink, waitFor } = require('./helpers/api');
const Click = require('../src/models/Click');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

const today = () => new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD

describe('Analytics aggregation', () => {
  it('returns the total and per-day click grouping', async () => {
    const auth = await authHeader();
    const link = await createLink(auth, 'https://example.com/stats');

    // Seed historical clicks on fixed UTC days (incl. both edges of a day)
    await Click.insertMany([
      { link: link.id, timestamp: new Date('2026-01-10T00:00:00Z') },
      { link: link.id, timestamp: new Date('2026-01-10T23:59:59Z') },
      { link: link.id, timestamp: new Date('2026-01-11T12:00:00Z'), referrer: 'https://news.example/' },
    ]);

    // Record two more through the real redirect endpoint (land on "today")
    await request(app).get(`/${link.shortCode}`).set('Referer', 'https://news.example/').expect(302);
    await request(app).get(`/${link.shortCode}`).expect(302);
    await waitFor(async () => (await Click.countDocuments({ link: link.id })) === 5);

    // A click on someone else's link must not be counted
    const otherAuth = await authHeader('grace@example.com');
    const otherLink = await createLink(otherAuth, 'https://example.com/other');
    await Click.create({ link: otherLink.id, timestamp: new Date('2026-01-10T08:00:00Z') });

    const res = await request(app)
      .get(`/api/links/${link.id}/stats`)
      .set('Authorization', auth)
      .expect(200);

    expect(res.body.linkId).toBe(link.id);
    expect(res.body.totalClicks).toBe(5);
    expect(res.body.clicksPerDay).toEqual([
      { date: '2026-01-10', clicks: 2 },
      { date: '2026-01-11', clicks: 1 },
      { date: today(), clicks: 2 },
    ]);
    expect(res.body.topReferrers).toEqual([
      { referrer: 'direct', clicks: 3 },
      { referrer: 'https://news.example/', clicks: 2 },
    ]);
  });

  it('returns zero totals for a link with no clicks', async () => {
    const auth = await authHeader();
    const link = await createLink(auth, 'https://example.com/quiet');

    const res = await request(app).get(`/api/links/${link.id}/stats`).set('Authorization', auth).expect(200);
    expect(res.body).toMatchObject({ totalClicks: 0, clicksPerDay: [], topReferrers: [] });
  });

  it("forbids reading another user's stats", async () => {
    const owner = await authHeader();
    const link = await createLink(owner, 'https://example.com/private');
    const intruder = await authHeader('mallory@example.com');

    await request(app).get(`/api/links/${link.id}/stats`).set('Authorization', intruder).expect(403);
  });

  it('requires a JWT', async () => {
    await request(app).get('/api/links/66f1c0a2b3c4d5e6f7a8b9c0/stats').expect(401);
  });
});
