# LinkStat

A URL shortener with click analytics.

## Tech stack

- Node.js (>= 22) + Express 5
- MongoDB + Mongoose
- JWT auth (jsonwebtoken) + bcrypt password hashing
- express-validator for request validation
- nanoid for short codes
- dotenv for configuration
- express-rate-limit for per-IP rate limiting
- Redis (optional, via `redis`) for the redirect cache, with an in-memory fallback

## Rate limiting & caching

- `POST /api/links`: 20 requests / 15 min per IP. `/auth/*`: 10 failed attempts / 15 min
  per IP (successful requests aren't counted). Over the limit → `429`
  `{ "error": "Too many requests", "message": "...", "retryAfter": <seconds> }`.
- `GET /:code` looks up `shortCode → originalUrl` in the cache first (1 h TTL) and only
  queries MongoDB on a miss. The response header `X-Cache: HIT|MISS` shows which.
  Deleting a link or changing its URL/code evicts its cache entry.
- Set `REDIS_URL` to use Redis (e.g. a free [Upstash](https://upstash.com) database:
  `REDIS_URL=rediss://default:<password>@<endpoint>.upstash.io:6379`). If it's unset or
  unreachable at startup, the app logs it and uses an in-process memory cache instead.

## API

| Method | Path               | Auth   | Description                              |
| ------ | ------------------ | ------ | ---------------------------------------- |
| GET    | `/health`          | –      | Health check → `{ "status": "ok" }`      |
| POST   | `/auth/register`   | –      | `{ name, email, password }` → user       |
| POST   | `/auth/login`      | –      | `{ email, password }` → `{ accessToken }`|
| POST   | `/api/links`       | Bearer | `{ url }` → link with `shortUrl`         |
| GET    | `/api/links`       | Bearer | List your links (newest first)           |
| GET    | `/:code`           | –      | 302 redirect to the original URL         |

Send the token as `Authorization: Bearer <accessToken>`.

## Planned features

- Shorten long URLs to short codes (optionally custom aliases)
- Fast redirects from short code to original URL
- Click analytics: total clicks, timestamps, referrer, user agent / device, country
- User accounts with authentication, each user managing their own links
- Link expiration and enable/disable
- Per-link analytics dashboard API

## Project structure

```
src/
  app.js          # Express app (middleware, routes, error handling)
  server.js       # Entry point: loads env, connects DB, starts server
  config/
    env.js        # Loads + validates environment variables
    db.js         # MongoDB connection
    cache.js      # Redis cache with in-memory fallback
  controllers/
    auth.js       # register / login
    links.js      # create, list, redirect
  middleware/
    auth.js       # JWT verification (requireAuth)
    validate.js   # express-validator error responder
    rateLimit.js  # per-IP rate limiters (links, auth)
  models/
    User.js       # User schema
    Link.js       # Link schema
  routes/
    health.js     # GET /health
    auth.js       # /auth/*
    links.js      # /api/links
  utils/
    shortCode.js  # nanoid short-code generator
    linkCache.js  # redirect cache helpers (shortCode -> originalUrl)
```

## Running locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your env file, set `MONGODB_URI` (local MongoDB or a free MongoDB Atlas cluster),
   and set `JWT_SECRET` to a long random value:
   ```bash
   cp .env.example .env
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
3. Start the server:
   ```bash
   npm run dev   # with auto-reload (nodemon)
   npm start     # plain node
   ```
4. Check it's up:
   ```bash
   curl http://localhost:3000/health
   # {"status":"ok"}
   ```
