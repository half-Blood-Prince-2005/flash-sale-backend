import Redis from "ioredis";
import { env } from "./env.js";

const redis = new Redis({
    host: env.redisHost,
    port: env.redisPort,
});

redis.on("connect", () => console.log("Redis connected"));
redis.on("error", (err) => console.error("Redis error:", err.message));

export default redis;
