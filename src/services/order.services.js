import { randomUUID } from "crypto";
import pool from "../config/db.js";
import redis from "../config/redis.js";
import { AppError } from "../middlewares/errorHandler.js";
import { stockKey } from "./product.services.js";

const LOCK_TTL_MS = 5000;               // a crashed server's lock frees itself after 5s
const PROCESSING_TTL_SECONDS = 30;      // a crashed purchase's note frees itself after 30s
const RESULT_TTL_SECONDS = 24 * 60 * 60; // a finished order is remembered for 24h

const idemKey = (userId, key) => `idem:${userId}:${key}`;
const lockKey = (productId) => `lock:product:${productId}`;

// ---------- Gate 1: idempotency ----------

// Writes "processing" only if no note exists yet.
// Returns { state: "new" }, { state: "processing" } or { state: "done", order }.
async function startIdempotency(userId, key, request) {
    const note = JSON.stringify({ state: "processing", request });

    // Almost always finishes on the first try. It only goes round again if an
    // old note expired between the SET and the GET below. 3 tries is plenty.
    for (let attempt = 1; attempt <= 3; attempt++) {
        const created = await redis.set(idemKey(userId, key), note, "EX", PROCESSING_TTL_SECONDS, "NX");
        if (created) return { state: "new" };

        const existing = await redis.get(idemKey(userId, key));
        if (!existing) continue; // expired just now, try again

        const saved = JSON.parse(existing);

        // The same key must always mean the same purchase.
        if (saved.request.productId !== request.productId || saved.request.quantity !== request.quantity) {
            throw new AppError(422, "IDEMPOTENCY_KEY_REUSED", "This key was already used for a different purchase");
        }
        return saved;
    }

    throw new AppError(409, "PURCHASE_IN_PROGRESS", "This purchase is already being processed");
}

async function saveIdempotencyResult(userId, key, request, order) {
    const note = JSON.stringify({ state: "done", request, order });
    await redis.set(idemKey(userId, key), note, "EX", RESULT_TTL_SECONDS);
}

async function clearIdempotency(userId, key) {
    await redis.del(idemKey(userId, key));
}

// ---------- Before gate 2: cheap sold-out check ----------

// Uses the live counter if stock was loaded. If it wasn't, MySQL decides later.
async function isSoldOut(productId, quantity) {
    const stock = await redis.get(stockKey(productId));
    return stock !== null && Number(stock) < quantity;
}

// ---------- Gate 2: Redis lock ----------

// Returns a token if we got the lock, or null if someone else holds it.
async function acquireLock(productId) {
    const token = randomUUID();
    const result = await redis.set(lockKey(productId), token, "PX", LOCK_TTL_MS, "NX");
    return result ? token : null;
}

async function releaseLock(productId) {
    await redis.del(lockKey(productId));
}

// ---------- Gate 3: MySQL transaction ----------

async function buyInTransaction(userId, productId, quantity, key) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // FOR UPDATE locks this row until commit, so no other purchase can change it.
        // The sale window is checked with the database clock.
        const [rows] = await conn.query(
            `SELECT price_paise, stock_quantity, is_active,
                    sale_starts_at IS NOT NULL AND sale_starts_at <= NOW() AS started,
                    sale_ends_at IS NOT NULL AND sale_ends_at <= NOW() AS ended
             FROM products WHERE id = ? FOR UPDATE`,
            [productId]
        );
        const product = rows[0];

        if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
        if (!product.is_active) throw new AppError(409, "PRODUCT_INACTIVE", "Product is not available");
        if (!product.started) throw new AppError(409, "SALE_NOT_STARTED", "Sale has not started yet");
        if (product.ended) throw new AppError(409, "SALE_ENDED", "Sale has ended");
        if (product.stock_quantity < quantity) throw new AppError(409, "SOLD_OUT", "Not enough stock left");

        await conn.query(
            `UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?`,
            [quantity, productId]
        );

        const orderId = randomUUID();
        const unitPrice = Number(product.price_paise);
        await conn.query(
            `INSERT INTO orders (id, user_id, product_id, quantity, unit_price_paise, total_amount_paise, status, idempotency_key)
             VALUES (?, ?, ?, ?, ?, ?, 'COMPLETED', ?)`,
            [orderId, userId, productId, quantity, unitPrice, unitPrice * quantity, key]
        );

        await conn.commit();
        return { orderId, newStock: product.stock_quantity - quantity };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

// Backup for when Redis has forgotten a finished purchase.
async function findByIdempotencyKey(userId, key) {
    const [rows] = await pool.query(
        `SELECT * FROM orders WHERE user_id = ? AND idempotency_key = ?`,
        [userId, key]
    );
    return rows[0] ?? null;
}

async function findOrder(orderId) {
    const [rows] = await pool.query(`SELECT * FROM orders WHERE id = ?`, [orderId]);
    return rows[0];
}

// ---------- Checkout ----------

export async function purchase(userId, productId, quantity, idempotencyKey) {
    const request = { productId, quantity };

    // Gate 1: is this a repeat?
    const saved = await startIdempotency(userId, idempotencyKey, request);
    if (saved.state === "done") return saved.order;
    if (saved.state === "processing") {
        throw new AppError(409, "PURCHASE_IN_PROGRESS", "This purchase is already being processed");
    }

    let token = null;
    try {
        // Turn people away cheaply once stock is gone, without taking the lock.
        if (await isSoldOut(productId, quantity)) {
            throw new AppError(409, "SOLD_OUT", "Not enough stock left");
        }

        // Gate 2: one purchase per product at a time.
        token = await acquireLock(productId);
        if (!token) {
            throw new AppError(429, "HIGH_TRAFFIC", "Too many people are buying right now, please retry");
        }

        // Gate 3: the real decision.
        let order;
        try {
            const { orderId, newStock } = await buyInTransaction(userId, productId, quantity, idempotencyKey);
            // Keep the live counter equal to MySQL. XX: only if stock was loaded.
            await redis.set(stockKey(productId), newStock, "XX");
            order = await findOrder(orderId);
        } catch (err) {
            // The orders table already has this user + key: Redis forgot, MySQL didn't.
            if (err.code !== "ER_DUP_ENTRY") throw err;
            order = await findByIdempotencyKey(userId, idempotencyKey);
        }

        await saveIdempotencyResult(userId, idempotencyKey, request, order);
        return order;
    } catch (err) {
        // Only finished orders are remembered. After any failure the note is
        // removed, so retrying with the same key runs the purchase again.
        await clearIdempotency(userId, idempotencyKey);
        throw err;
    } finally {
        if (token) await releaseLock(productId);
    }
}

// ---------- Reading orders ----------

// Every list is returned in pages: 20 orders by default, never more than 100.
function toPage({ limit, offset } = {}) {
    return {
        limit: Math.min(Math.max(Number(limit) || 20, 1), 100),
        offset: Math.max(Number(offset) || 0, 0),
    };
}

// Orders with the product title, so order history is readable.
const ORDER_COLUMNS = `
    o.id, o.user_id, o.product_id, p.title AS product_title, o.quantity,
    o.unit_price_paise, o.total_amount_paise, o.status, o.created_at`;

// One order for its owner. Someone else's order gives the same 404 as a
// missing one, so nobody can find out which order IDs exist.
export async function getById(orderId, userId) {
    const [rows] = await pool.query(
        `SELECT ${ORDER_COLUMNS}
         FROM orders o JOIN products p ON p.id = o.product_id
         WHERE o.id = ? AND o.user_id = ?`,
        [orderId, userId]
    );
    if (!rows[0]) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found");
    return rows[0];
}

// A buyer's order history, newest first.
export async function listMine(userId, pageOptions) {
    const { limit, offset } = toPage(pageOptions);
    const [rows] = await pool.query(
        `SELECT ${ORDER_COLUMNS}
         FROM orders o JOIN products p ON p.id = o.product_id
         WHERE o.user_id = ?
         ORDER BY o.created_at DESC, o.id
         LIMIT ? OFFSET ?`,
        [userId, limit, offset]
    );
    return rows;
}

// Admin: every order, newest first.
export async function listAll(pageOptions) {
    const { limit, offset } = toPage(pageOptions);
    const [rows] = await pool.query(
        `SELECT ${ORDER_COLUMNS}
         FROM orders o JOIN products p ON p.id = o.product_id
         ORDER BY o.created_at DESC, o.id
         LIMIT ? OFFSET ?`,
        [limit, offset]
    );
    return rows;
}

// Admin: who bought one product, newest first.
export async function listByProduct(productId, pageOptions) {
    const { limit, offset } = toPage(pageOptions);
    const [rows] = await pool.query(
        `SELECT ${ORDER_COLUMNS}
         FROM orders o JOIN products p ON p.id = o.product_id
         WHERE o.product_id = ?
         ORDER BY o.created_at DESC, o.id
         LIMIT ? OFFSET ?`,
        [productId, limit, offset]
    );
    return rows;
}
