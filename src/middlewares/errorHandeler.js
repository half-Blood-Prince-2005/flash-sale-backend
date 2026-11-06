export class AppError extends Error {
    constructor(status, code, message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

export function notFound(req, res) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
}

export function errorHandler(err, req, res, next) {
    if (err instanceof AppError) {
        return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    }

    // Bad JSON in request body
    if (err.type === "entity.parse.failed") {
        return res.status(400).json({ error: { code: "INVALID_JSON", message: "Invalid JSON body" } });
    }

    console.error(err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
}