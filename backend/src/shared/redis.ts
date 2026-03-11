import { createClient, type RedisClientType } from 'redis';
import { config } from '../config.js';

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType | null> | null = null;

async function getRedisClientInternal(): Promise<RedisClientType | null> {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }

  if (!config.REDIS_URL) {
    return null;
  }

  if (client) {
    return client;
  }

  if (!connecting) {
    const instance = createClient({ url: config.REDIS_URL });

    instance.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('Redis client error:', err);
    });

    connecting = instance
      .connect()
      .then(() => {
        client = instance;
        return instance;
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Failed to connect to Redis, caching disabled:', err);
        client = null;
        return null;
      });
  }

  return connecting;
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  const redis = await getRedisClientInternal();
  if (!redis) return null;

  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to read from Redis cache:', err);
    return null;
  }
}

export async function setCachedJson<T>(key: string, value: T, ttlSeconds = config.REDIS_CACHE_TTL_SECONDS): Promise<void> {
  const redis = await getRedisClientInternal();
  if (!redis) return;

  try {
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to write to Redis cache:', err);
  }
}

