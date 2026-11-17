import { env } from "./env.js";
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
    host: env.dbHost,
    port: env.dbPort || 3306,
    user: env.dbUser,
    password: env.dbPassword,
    database: env.dbName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Send and read dates as UTC to match the database. Without this, mysql2 uses
    // this machine's time zone and every saved date is shifted by the offset.
    timezone: "Z",
});

export async function checkDbConnection() {
    const conn = await pool.getConnection();
    try {
        await conn.ping();
        console.log("MySQL connected");
    } finally {
        conn.release();
    }
}

export default pool;