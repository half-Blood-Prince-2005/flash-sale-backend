// Validates req.body. Returns the cleaned data, or sends a 400 and returns null.
export function parseBody(schema, req, res) {
    const result = schema.safeParse(req.body ?? {});
    if (result.success) {
        return result.data;
    }

    res.status(400).json({
        error: {
            code: "VALIDATION_ERROR",
            message: "Request body is invalid",
            details: result.error.issues.map((issue) => ({
                field: issue.path.join(".") || "body",
                message: issue.message,
            })),
        },
    });
    return null;
}
