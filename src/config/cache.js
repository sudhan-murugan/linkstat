const { createClient } = require('redis');
const { redisUrl } = require('./env');

// Key/value cache with a Redis backend when REDIS_URL is set and reachable,
// otherwise an in-process memory cache. Cache errors never throw to callers:
// a failed read is a miss, a failed write/delete is logged and ignored.

const DEFAULT_TTL_SECONDS = 60 * 60;
const MEMORY_MAX_ENTRIES = 10_000;

// Simple TTL cache; Map keeps insertion order, so the oldest entry is evicted first.
function createMemoryStore() {
  const entries = new Map();
  return {
    name: 'memory',
    async get(key) {
      const entry = entries.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= Date.now()) {
        entries.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key, value, ttlSeconds) {
      entries.delete(key);
      if (entries.size >= MEMORY_MAX_ENTRIES) entries.delete(entries.keys().next().value);
      entries.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    },
    async del(keys) {
      keys.forEach((key) => entries.delete(key));
    },
    async close() {
      entries.clear();
    },
  };
}

function createRedisStore(client) {
  return {
    name: 'redis',
    get: (key) => client.get(key),
    set: (key, value, ttlSeconds) => client.set(key, value, { expiration: { type: 'EX', value: ttlSeconds } }),
    del: (keys) => client.del(keys),
    close: () => client.close(),
  };
}

let store = createMemoryStore();

// Try Redis once at startup; if it's missing or unreachable, keep the memory store.
async function connectCache() {
  if (!redisUrl) {
    console.log('Cache: REDIS_URL not set, using in-memory cache');
    return;
  }

  let connected = false;
  const client = createClient({
    url: redisUrl,
    // Fail fast instead of queueing commands while Redis is down, so a Redis
    // outage degrades to cache misses rather than hanging requests.
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 5000,
      // Give up if the first connection fails; after that, keep reconnecting.
      reconnectStrategy: (retries, cause) =>
        connected ? Math.min(retries * 200, 5000) : cause,
    },
  });
  client.on('error', (err) => {
    if (connected) console.error('Redis error:', err.message);
  });

  try {
    await client.connect();
    connected = true;
    store = createRedisStore(client);
    console.log('Cache: connected to Redis');
  } catch (err) {
    console.warn(`Cache: Redis unavailable (${err.message}), falling back to in-memory cache`);
    if (client.isOpen) client.destroy(); // usually already closed by reconnectStrategy
  }
}

async function disconnectCache() {
  await store.close().catch(() => {});
}

async function cacheGet(key) {
  try {
    const raw = await store.get(key);
    return raw == null ? null : JSON.parse(raw);
  } catch (err) {
    console.error('Cache read failed:', err.message);
    return null;
  }
}

async function cacheSet(key, value, ttlSeconds = DEFAULT_TTL_SECONDS) {
  try {
    await store.set(key, JSON.stringify(value), ttlSeconds);
  } catch (err) {
    console.error('Cache write failed:', err.message);
  }
}

async function cacheDel(...keys) {
  if (!keys.length) return;
  try {
    await store.del(keys);
  } catch (err) {
    console.error('Cache delete failed:', err.message);
  }
}

const cacheBackend = () => store.name;

module.exports = { connectCache, disconnectCache, cacheGet, cacheSet, cacheDel, cacheBackend };
