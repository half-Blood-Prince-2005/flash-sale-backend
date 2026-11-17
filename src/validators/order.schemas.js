import { z } from "zod";

export const purchaseSchema = z.object({
    productId: z.uuid({
        error: (issue) => (issue.input === undefined ? "Product ID is required" : "Product ID must be a valid ID"),
    }),
    // Defaults to 1 when not sent.
    quantity: z
        .int({ error: "Quantity must be a whole number" })
        .min(1, { error: "Quantity must be at least 1" })
        .default(1),
});
