# LinkStat

A URL shortener REST API with click analytics. Users sign up, shorten long URLs into
7-character codes, share them, and get per-link stats: total clicks, clicks per day and
top referrers. Redirects are served from a cache (Redis, or in-memory as a fallback) and
click tracking never slows a redirect down.

**Interactive API docs:** once the server is running, open
[http://localhost:3000/api/docs](http://localhost:3000/api/docs) (Swagger UI). The raw
OpenAPI 3 spec is at `/api/docs.json`.

## Tech stack

- **Runtime:** Node.js (>= 22) + Express 5
- **Database:** MongoDB + Mongoose (aggregation pipelines for analytics)
- **Auth:** JWT (jsonwebtoken, HS256) + bcrypt password hashing
- **Validation:** express-validator
- **Short codes:** nanoid
- **Caching:** Redis (optional, via `redis`) with an in-memory fallback
- **Rate limiting:** express-rate-limit
- **API docs:** OpenAPI 3 + swagger-ui-express
- **Testing:** Jest + Supertest + mongodb-memory-server

## Features

- **Accounts** — register and log in; passwords are bcrypt-hashed, and login responds
  the same way (and in similar time) whether or not the email exists.
- **JWT auth** — `Authorization: Bearer <token>` on all `/api/links` routes.
- **URL shortening** — `http(s)` URLs only (max 2048 chars) become unique 7-char
  alphanumeric codes; each user sees only their own links.
- **Fast redirects** — `GET /:code` responds `302` (not `301`) so every visit is counted.
  Lookups hit the cache first (1 h TTL) and only query MongoDB on a miss; the
  `X-Cache: HIT|MISS` header shows which. Changing or deleting a link evicts it.
- **Click tracking** — each visit records timestamp, referrer, user agent and IP, and
  bumps the link's `clickCount`. Writes are fire-and-forget: a failed write never breaks
  a redirect.
- **Analytics** (owner only) — total clicks, clicks grouped per UTC day, top 10
  referrers (`direct` when there's no `Referer`), and a paginated raw click log.
- **Rate limiting** — `POST /api/links`: 20 requests / 15 min per IP. `/auth/*`: 10
  failed attempts / 15 min per IP (successful requests aren't counted). Over the limit →
  `429 { "error": "Too many requests", "message": "...", "retryAfter": <seconds> }`.
- **Swagger docs** — at `/api/docs`, with a built-in **Authorize** button for JWTs.
- **Tests** — Jest + Supertest against an isolated in-memory MongoDB.

## Getting started

Prerequisites: Node.js 22+ (24.9+ to run the tests), and a MongoDB instance (local, or a
free MongoDB Atlas cluster). Redis is optional.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your env file and fill it in (see [Environment variables](#environment-variables)):
   ```bash
   cp .env.example .env
   # generate a JWT secret:
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
3. Start the server:
   ```bash
   npm run dev   # with auto-reload (nodemon)
   npm start     # plain node
   ```
4. Check it's up, then open the docs at http://localhost:3000/api/docs:
   ```bash
   curl http://localhost:3000/health
   # {"status":"ok"}
   ```

### Quick tour with curl

```bash
# Register + log in
curl -X POST localhost:3000/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Ada","email":"ada@example.com","password":"correct-horse-battery"}'
TOKEN=$(curl -s -X POST localhost:3000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"ada@example.com","password":"correct-horse-battery"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')

# Shorten a URL
curl -X POST localhost:3000/api/links -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"url":"https://example.com/some/long/page"}'

# Follow it, then check the stats
curl -i localhost:3000/<shortCode>
curl localhost:3000/api/links/<id>/stats -H "Authorization: Bearer $TOKEN"
```

## Environment variables

| Variable         | Required | Default       | Description                                                                                             |
| ---------------- | -------- | ------------- | ------------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`    | yes      | –             | MongoDB connection string, e.g. `mongodb://127.0.0.1:27017/linkstat` or an Atlas `mongodb+srv://` URI    |
| `JWT_SECRET`     | yes      | –             | Secret used to sign JWTs; at least 32 characters                                                        |
| `JWT_EXPIRES_IN` | yes      | –             | Token lifetime, e.g. `1h`, `7d`                                                                         |
| `BASE_URL`       | yes      | –             | Public origin used to build short URLs (no trailing slash), e.g. `http://localhost:3000`                |
| `PORT`           | no       | `3000`        | HTTP port                                                                                               |
| `NODE_ENV`       | no       | `development` | Runtime environment                                                                                     |
| `REDIS_URL`      | no       | –             | Redis for the redirect cache (e.g. Upstash `rediss://...`). Unset or unreachable → in-memory cache      |
| `TRUST_PROXY`    | no       | `0`           | Number of reverse proxies in front of the app, so rate limits and click tracking see the real client IP |

The app refuses to start if a required variable is missing. See `.env.example`.

## API endpoints

Full request/response schemas are in the Swagger docs at **`/api/docs`**.
"JWT" = send `Authorization: Bearer <accessToken>` from `POST /auth/login`.

| Method | Path                     | Auth | Description                                                          |
| ------ | ------------------------ | ---- | -------------------------------------------------------------------- |
| GET    | `/health`                | –    | Health check → `{ "status": "ok" }`                                  |
| POST   | `/auth/register`         | –    | `{ name, email, password }` → `201 { user }`                         |
| POST   | `/auth/login`            | –    | `{ email, password }` → `{ accessToken, tokenType, expiresIn }`      |
| POST   | `/api/links`             | JWT  | `{ url }` → `201 { link }` with `shortCode` and `shortUrl`           |
| GET    | `/api/links`             | JWT  | Your links, newest first                                             |
| GET    | `/api/links/:id/stats`   | JWT  | Owner only: `{ totalClicks, clicksPerDay, topReferrers }`            |
| GET    | `/api/links/:id/clicks`  | JWT  | Owner only: raw clicks, newest first (`?page=1&limit=20`, max 100)   |
| GET    | `/:code`                 | –    | `302` redirect to the original URL (records a click)                 |
| GET    | `/api/docs`              | –    | Swagger UI                                                           |
| GET    | `/api/docs.json`         | –    | OpenAPI 3 spec (JSON)                                                |

Errors are JSON: `{ "error": "..." }`, plus `details: [{ field, message }]` on `400`
validation errors.

Example stats response:

```json
{
  "linkId": "66f1c0a2b3c4d5e6f7a8b9c1",
  "totalClicks": 5,
  "clicksPerDay": [
    { "date": "2026-09-28", "clicks": 2 },
    { "date": "2026-09-29", "clicks": 3 }
  ],
  "topReferrers": [
    { "referrer": "direct", "clicks": 3 },
    { "referrer": "https://news.ycombinator.com/", "clicks": 2 }
  ]
}
```

## Testing

```bash
npm test
```

Tests use [mongodb-memory-server](https://github.com/typegoose/mongodb-memory-server):
each test file starts its own throwaway MongoDB, so your dev database is never touched,
and everything is dropped and shut down afterwards. The first run downloads a MongoDB
binary (cached in `node_modules/.cache`). The in-memory cache is always used in tests.

- `tests/links.test.js` — shortening flow: create a link → get a code → the redirect
  resolves to the original URL (cache MISS then HIT) and clicks are recorded.
- `tests/analytics.test.js` — after recording clicks, `/stats` returns the correct total,
  per-day grouping (UTC) and referrers; plus auth / ownership checks.

`npm test` runs Jest with `--experimental-vm-modules` because `nanoid` is ESM-only.

## Project structure

```
src/
  app.js            # Express app (middleware, routes, docs, error handling)
  server.js         # Entry point: connects DB + cache, starts server
  config/
    env.js          # Loads + validates environment variables
    db.js           # MongoDB connection
    cache.js        # Redis cache with in-memory fallback
  controllers/
    auth.js         # register / login
    links.js        # create, list, redirect + click tracking
    analytics.js    # stats aggregation, click log, ownership check
  docs/
    openapi.js      # OpenAPI 3 spec served at /api/docs
  middleware/
    auth.js         # JWT verification (requireAuth)
    validate.js     # express-validator error responder
    rateLimit.js    # per-IP rate limiters (links, auth)
  models/
    User.js         # User schema
    Link.js         # Link schema (+ cache invalidation hooks)
    Click.js        # Click event schema
  routes/
    health.js       # GET /health
    auth.js         # /auth/*
    links.js        # /api/links (+ analytics)
  utils/
    shortCode.js    # nanoid short-code generator
    linkCache.js    # redirect cache helpers (shortCode -> originalUrl)
tests/
  helpers/          # env setup, in-memory MongoDB, API helpers
  links.test.js
  analytics.test.js
```
