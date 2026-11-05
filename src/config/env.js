import "dotenv/config";

export const env = {
    dbHost: process.env.DB_HOST,
    dbPort: Number(process.env.DB_PORT) || 3306,
    dbUser: process.env.DB_USER,
    dbPassword: process.env.DB_PASSWORD,
    dbName: process.env.DB_NAME,

    serverPort: Number(process.env.SERVER_PORT) || 3000,

    redisHost: process.env.REDIS_HOST || "127.0.0.1",
    redisPort: Number(process.env.REDIS_PORT) || 6379,

    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",

    smtpHost: process.env.SMTP_HOST,
    smtpPort: Number(process.env.SMTP_PORT) || 587,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    mailFrom: process.env.MAIL_FROM || process.env.SMTP_USER,
};
