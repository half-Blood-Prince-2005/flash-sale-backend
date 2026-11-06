import "dotenv/config";
import os from "os";

export const env = {
    dbHost: process.env.DB_HOST,
    dbPort: Number(process.env.DB_PORT) || 3306,
    dbUser: process.env.DB_USER,
    dbPassword: process.env.DB_PASSWORD,
    dbName: process.env.DB_NAME,

    serverPort: Number(process.env.SERVER_PORT) || 3000,
    instanceId: process.env.INSTANCE_ID || `${os.hostname()}-${process.pid}`,

    redisHost: process.env.REDIS_HOST || "127.0.0.1",
    redisPort: Number(process.env.REDIS_PORT) || 6379,

    jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
    jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "1d",
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",

    smtpHost: process.env.SMTP_HOST,
    smtpPort: Number(process.env.SMTP_PORT) || 587,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    mailFrom: process.env.MAIL_FROM || process.env.SMTP_USER,
};
