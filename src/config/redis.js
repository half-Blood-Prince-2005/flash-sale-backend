import Redis from "ioredis";
import { env } from "./env.js";

const redis = new Redis({
    host: env.redisHost,
    port: env.redisPort,
});

export async function checkRedisConnection() {
    try {
        await redis.ping();
        console.log("Redis connection successful");
    } catch (err) {
        console.error("Redis connection failed:", err.message);
        process.exit(1);
    }
}
redis.on("connect", () => console.log("Redis connected"));
redis.on("error", (err) => console.error("Redis error:", err.message));

export default redis;
