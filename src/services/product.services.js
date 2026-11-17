import { randomUUID } from "crypto";
import pool from "../config/db.js";
import redis from "../config/redis.js";
import { AppError } from "../middlewares/errorHandler.js";

const CACHE_KEY = "products:active";
const CACHE_TTL_SECONDS = 2;

// Live stock for a sale. The purchase flow takes stock from this key.
export const stockKey = (id) => `stock:${id}`;

// Request field -> column. Only these can be changed through update().
const UPDATABLE = {
    title: "title",
    pricePaise: "price_paise",
    stockQuantity: "stock_quantity",
    saleStartsAt: "sale_starts_at",
    saleEndsAt: "sale_ends_at",
    isActive: "is_active",
};

export async function listActive() {
    const cached = await redis.get(CACHE_KEY);
    if (cached) return JSON.parse(cached);

    const [rows] = await pool.query(
        `SELECT id, title, price_paise, stock_quantity, sale_starts_at, sale_ends_at
         FROM products
         WHERE is_active = TRUE
         ORDER BY created_at DESC`
    );

    await redis.set(CACHE_KEY, JSON.stringify(rows), "EX", CACHE_TTL_SECONDS);
    return rows;
}

export async function getById(id) {
    const [rows] = await pool.query(
        `SELECT id, title, price_paise, stock_quantity, sale_starts_at, sale_ends_at, is_active
         FROM products WHERE id = ?`,
        [id]
    );
    if (!rows[0]) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
    return rows[0];
}

export async function create({ title, pricePaise, stockQuantity, saleStartsAt, saleEndsAt }) {
    const id = randomUUID();
    await pool.query(
        `INSERT INTO products (id, title, price_paise, stock_quantity, sale_starts_at, sale_ends_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, title, pricePaise, stockQuantity, saleStartsAt ?? null, saleEndsAt ?? null]
    );
    await redis.del(CACHE_KEY);
    return getById(id);
}

export async function listAll() {
    const [rows] = await pool.query(
        `SELECT id, title, price_paise, stock_quantity, sale_starts_at, sale_ends_at,
                is_active, created_at, updated_at
         FROM products
         ORDER BY created_at DESC`
    );
    return rows;
}

export async function update(id, fields) {
    const columns = []; // e.g. ["title = ?", "price_paise = ?"]
    const values = [];  // e.g. ["New phone", 1999900]

    // Go through the allowed fields only, so anything else the client sends is ignored.
    for (const field in UPDATABLE) {
        // undefined means "not sent". null is kept, so saleEndsAt: null clears the end date.
        if (fields[field] !== undefined) {
            columns.push(`${UPDATABLE[field]} = ?`);
            values.push(fields[field]);
        }
    }

    if (columns.length === 0) return getById(id);

    const [result] = await pool.query(
        `UPDATE products SET ${columns.join(", ")} WHERE id = ?`,
        [...values, id]
    );
    if (result.affectedRows === 0) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");

    // If stock is already loaded for a sale, keep Redis in step with MySQL.
    // XX only sets the key if it exists, so this never starts a sale by itself.
    if (fields.stockQuantity !== undefined) {
        await redis.set(stockKey(id), fields.stockQuantity, "XX");
    }

    await redis.del(CACHE_KEY);
    return getById(id);
}

// Hides the product instead of deleting it. Orders point at products, so a
// real delete would fail once anything was sold. update(id, { isActive: true })
// brings it back. The Redis stock key is left alone so no sold count is lost.
export async function deactivate(id) {
    const [result] = await pool.query(`UPDATE products SET is_active = FALSE WHERE id = ?`, [id]);
    if (result.affectedRows === 0) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
    await redis.del(CACHE_KEY);
}

// Copies stock from MySQL into Redis before a sale starts.
export async function loadStock(id) {
    const product = await getById(id);
    if (!product.is_active) throw new AppError(409, "PRODUCT_INACTIVE", "Product is not active");

    // NX: never overwrite a counter that already exists. Reloading during a sale
    // would put back units that were already sold and cause overselling.
    const result = await redis.set(stockKey(id), product.stock_quantity, "NX");
    const stock = Number(await redis.get(stockKey(id)));
    return { productId: id, stock, loaded: result === "OK" };
}

// Live stock from Redis during a sale, or the MySQL value if not loaded yet.
export async function getStock(id) {
    const live = await redis.get(stockKey(id));
    if (live !== null) return { productId: id, stock: Number(live), live: true };

    const product = await getById(id);
    return { productId: id, stock: product.stock_quantity, live: false };
}
