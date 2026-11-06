import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";
import redis from "../config/redis.js";
import { env } from "../config/env.js";
import { AppError } from "../middlewares/errorHandeler.js";

const SALT_ROUNDS = 12;

// Compared against when the email doesn't exist, so a missing user
// takes as long as a wrong password and can't be detected by timing.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", SALT_ROUNDS);

// Each live refresh token has a Redis key named after its jti. Deleting the
// key when the token is used makes every refresh token single-use.
const refreshKey = (jti) => `refresh:${jti}`;

async function issueTokens(user) {
    if (!env.jwtAccessSecret || !env.jwtRefreshSecret) {
        throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must both be set");
    }

    const accessToken = jwt.sign(
        { sub: user.id, email: user.email, role: user.role, type: "access" },
        env.jwtAccessSecret,
        { expiresIn: env.jwtAccessExpiresIn }
    );

    // Kept minimal: it only proves who the user is. Role and email are
    // reloaded from the database on every refresh.
    const jti = randomUUID();
    const refreshToken = jwt.sign(
        { sub: user.id, type: "refresh" },
        env.jwtRefreshSecret,
        { expiresIn: env.jwtRefreshExpiresIn, jwtid: jti }
    );

    // The Redis key expires at the same moment as the token itself.
    const { exp } = jwt.decode(refreshToken);
    const ttlSeconds = exp - Math.floor(Date.now() / 1000);
    await redis.set(refreshKey(jti), user.id, "EX", ttlSeconds);

    return { accessToken, refreshToken };
}

function toPublicUser(row) {
    return { id: row.id, email: row.email, role: row.role, createdAt: row.created_at };
}

export async function register({ email, password }) {
    const id = randomUUID();
    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    try {
        // role is left to the column default (USER). Never take it from the request.
        await pool.execute(
            "INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
            [id, normalizedEmail, passwordHash]
        );
    } catch (err) {
        // The unique index on email catches duplicates, including two
        // signups racing each other, without a separate lookup first.
        if (err.code === "ER_DUP_ENTRY") {
            throw new AppError(409, "EMAIL_TAKEN", "An account with this email already exists");
        }
        throw err;
    }

    const [rows] = await pool.execute(
        "SELECT id, email, role, created_at FROM users WHERE id = ?",
        [id]
    );
    const user = toPublicUser(rows[0]);

    return { user, ...(await issueTokens(user)) };
}

export async function login({ email, password }) {
    const normalizedEmail = email.trim().toLowerCase();

    const [rows] = await pool.execute(
        "SELECT id, email, role, password_hash, created_at FROM users WHERE email = ?",
        [normalizedEmail]
    );
    const row = rows[0];

    const passwordOk = await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH);
    if (!row || !passwordOk) {
        throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    const user = toPublicUser(row);
    return { user, ...(await issueTokens(user)) };
}

export async function refresh(refreshToken) {
    const invalid = () => new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired");

    let payload;
    try {
        payload = jwt.verify(refreshToken, env.jwtRefreshSecret);
    } catch {
        throw invalid();
    }
    if (payload.type !== "refresh" || !payload.jti || !payload.sub) {
        throw invalid();
    }

    // DEL is atomic. If the same token is sent twice at once, only one
    // request gets 1 back, so a token can never be exchanged twice.
    const deleted = await redis.del(refreshKey(payload.jti));
    if (deleted !== 1) {
        throw invalid();
    }

    // Reload the user so a deleted account or a role change takes effect now.
    const [rows] = await pool.execute(
        "SELECT id, email, role, created_at FROM users WHERE id = ?",
        [payload.sub]
    );
    if (!rows[0]) {
        throw invalid();
    }

    return issueTokens(toPublicUser(rows[0]));
}

// Revokes one refresh token so it can't be exchanged again.
// Always succeeds: logging out twice, or with an expired token, is not an
// error, and the caller learns nothing about whether the token was live.
export async function logout(refreshToken) {
    let payload;
    try {
        payload = jwt.verify(refreshToken, env.jwtRefreshSecret);
    } catch {
        // Bad signature: not our token, so there is nothing to revoke.
        // Expired: its Redis entry has already expired on its own.
        return;
    }
    if (payload.type !== "refresh" || !payload.jti) {
        return;
    }
    await redis.del(refreshKey(payload.jti));
}
