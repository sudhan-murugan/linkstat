# LinkStat

A URL shortener with click analytics.

## Tech stack

- Node.js (>= 18) + Express 5
- MongoDB + Mongoose
- dotenv for configuration

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
  models/
    User.js       # User schema
  routes/
    health.js     # GET /health
```

## Running locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your env file and set `MONGODB_URI` (local MongoDB or a free MongoDB Atlas cluster):
   ```bash
   cp .env.example .env
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
