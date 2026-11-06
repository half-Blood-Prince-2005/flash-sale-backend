import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "./errorHandler.js";

// Any logged-in user, including admins.
// Expects the header "Authorization: Bearer <access token>" and puts the
// user on req.user as { id, email, role }.
export function requireUser(req, res, next) {
    const header = req.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
        throw new AppError(401, "UNAUTHORIZED", "Missing or malformed access token");
    }

    let payload;
    try {
        payload = jwt.verify(token, env.jwtAccessSecret);
    } catch (err) {
        // A separate code tells the client to call /refresh rather than
        // sending the user back to the login screen.
        if (err.name === "TokenExpiredError") {
            throw new AppError(401, "TOKEN_EXPIRED", "Access token has expired");
        }
        throw new AppError(401, "UNAUTHORIZED", "Invalid access token");
    }

    // Stops a refresh token from being used as an access token.
    if (payload.type !== "access") {
        throw new AppError(401, "UNAUTHORIZED", "Invalid access token");
    }

    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    next();
}

// Admins only. Checks the token first, then the role, so it can be used
// on its own: router.post("/products", requireAdmin, createProduct)
export function requireAdmin(req, res, next) {
    requireUser(req, res, () => {
        if (req.user.role !== "ADMIN") {
            throw new AppError(403, "FORBIDDEN", "Admin access required");
        }
        next();
    });
}
