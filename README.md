# LinkStat

A URL shortener with click analytics.

## Tech stack

- Node.js (>= 22) + Express 5
- MongoDB + Mongoose
- JWT auth (jsonwebtoken) + bcrypt password hashing
- express-validator for request validation
- nanoid for short codes
- dotenv for configuration

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
  controllers/
    auth.js       # register / login
    links.js      # create, list, redirect
  middleware/
    auth.js       # JWT verification (requireAuth)
    validate.js   # express-validator error responder
  models/
    User.js       # User schema
    Link.js       # Link schema
  routes/
    health.js     # GET /health
    auth.js       # /auth/*
    links.js      # /api/links
  utils/
    shortCode.js  # nanoid short-code generator
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
