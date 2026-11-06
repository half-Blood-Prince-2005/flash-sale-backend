import app from "./index.js";
import pool, { checkDbConnection } from "./src/config/db.js";
import redis, { checkRedisConnection } from "./src/config/redis.js";
import { env } from "./src/config/env.js";

await checkDbConnection();
await checkRedisConnection();

const port = env.serverPort;
const server = app.listen(port, () => console.log(`Server running on port ${port}`));

async function shutdown() {
    console.log("Shutting down...");
    server.close(async () => {
        await pool.end();
        await redis.quit();
        process.exit(0);
    });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);