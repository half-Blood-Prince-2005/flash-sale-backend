import * as authService from "../services/auth.services.js";
import {
    parseBody,
    registerSchema,
    loginSchema,
    refreshSchema,
    logoutSchema,
} from "../validators/auth.schemas.js";

// Express 5 forwards errors thrown in async handlers to the error handler,
// so service errors like 401 and 409 need no try/catch here.

export async function register(req, res) {
    const body = parseBody(registerSchema, req, res);
    if (!body) return;

    const result = await authService.register(body);
    res.status(201).json(result);
}

export async function login(req, res) {
    const body = parseBody(loginSchema, req, res);
    if (!body) return;

    const result = await authService.login(body);
    res.status(200).json(result);
}

export async function refresh(req, res) {
    const body = parseBody(refreshSchema, req, res);
    if (!body) return;

    const tokens = await authService.refresh(body.refreshToken);
    res.status(200).json(tokens);
}

export async function logout(req, res) {
    const body = parseBody(logoutSchema, req, res);
    if (!body) return;

    await authService.logout(body.refreshToken);
    res.status(204).end();
}
