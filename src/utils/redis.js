const redis = require('redis');

const createRedisClient = () => {
  return redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: {
      reconnectStrategy: retries => Math.min(retries * 100, 3000),
      connectTimeout: 10000,
      keepAlive: 5000
    }
  });
};

module.exports = { createRedisClient };
