import * as orderService from "../services/order.services.js";
import { parseBody } from "../validators/parseBody.js";
import { purchaseSchema } from "../validators/order.schemas.js";

// ?limit=20&offset=40 -> { limit: "20", offset: "40" }. The service turns these
// into numbers and falls back to defaults for missing or bad values.
const pageFrom = (req) => ({ limit: req.query.limit, offset: req.query.offset });

// Buyer

export async function purchase(req, res) {
    const body = parseBody(purchaseSchema, req, res);
    if (!body) return;

    // The app makes one key per purchase attempt and sends it on every retry.
    // 255 is the size of the idempotency_key column.
    const idempotencyKey = req.get("Idempotency-Key");
    if (!idempotencyKey || idempotencyKey.length > 255) {
        return res.status(400).json({
            error: {
                code: "IDEMPOTENCY_KEY_REQUIRED",
                message: "Send an Idempotency-Key header between 1 and 255 characters",
            },
        });
    }

    try {
        // The buyer always comes from the access token, never from the body.
        const order = await orderService.purchase(req.user.id, body.productId, body.quantity, idempotencyKey);
        res.status(201).json(order);
    } catch (err) {
        // Tell the app how long to wait before retrying, then let the error handler reply.
        if (err.code === "HIGH_TRAFFIC") res.set("Retry-After", "1");
        throw err;
    }
}

export async function listMine(req, res) {
    const orders = await orderService.listMine(req.user.id, pageFrom(req));
    res.json(orders);
}

export async function getById(req, res) {
    const order = await orderService.getById(req.params.id, req.user.id);
    res.json(order);
}

// Admin

export async function listAll(req, res) {
    const orders = await orderService.listAll(pageFrom(req));
    res.json(orders);
}

export async function listByProduct(req, res) {
    const orders = await orderService.listByProduct(req.params.productId, pageFrom(req));
    res.json(orders);
}
