const request = require('supertest');
const app = require('../../src/app');

// Registers a fresh user and returns a ready-to-use "Authorization" header value.
async function authHeader(email = 'ada@example.com') {
  const password = 'correct-horse-battery';
  await request(app).post('/auth/register').send({ name: 'Ada', email, password }).expect(201);
  const res = await request(app).post('/auth/login').send({ email, password }).expect(200);
  return `Bearer ${res.body.accessToken}`;
}

async function createLink(auth, url) {
  const res = await request(app).post('/api/links').set('Authorization', auth).send({ url }).expect(201);
  return res.body.link;
}

// Click tracking is fire-and-forget, so poll until the expected writes land.
async function waitFor(check, { timeoutMs = 5000, intervalMs = 25 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error('waitFor: timed out');
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

module.exports = { app, authHeader, createLink, waitFor };
