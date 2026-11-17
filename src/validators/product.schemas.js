import { z } from "zod";

// "Title is required" when the field is missing, otherwise the given message.
const missingOr = (label, message) => (issue) =>
    issue.input === undefined ? `${label} is required` : message;

const title = z
    .string({ error: missingOr("Title", "Title must be text") })
    .trim()
    .min(1, { error: "Title is required" })
    .max(255, { error: "Title must be at most 255 characters" });

// Whole paise only, so there are never rounding errors in money.
const pricePaise = z
    .int({ error: missingOr("Price", "Price must be a whole number of paise") })
    .min(0, { error: "Price can't be negative" });

// 2147483647 is the largest value the stock_quantity column can hold.
const stockQuantity = z
    .int({ error: missingOr("Stock", "Stock must be a whole number") })
    .min(0, { error: "Stock can't be negative" })
    .max(2147483647, { error: "Stock is too large" });

// Dates must include a time zone, like "2026-12-01T10:00:00Z" or
// "2026-12-01T15:30:00+05:30", so there is never doubt about which 10am is meant.
// null means "no date" and clears it on update.
const saleDate = z
    .iso.datetime({ offset: true, error: "Use an ISO date with a time zone, like 2026-12-01T10:00:00+05:30" })
    .transform((value) => new Date(value))
    .nullable()
    .optional();

const endsAfterStart = (data) =>
    !data.saleStartsAt || !data.saleEndsAt || data.saleEndsAt > data.saleStartsAt;
const endsAfterStartError = { error: "Sale end must be after sale start", path: ["saleEndsAt"] };

export const createProductSchema = z
    .object({
        title,
        pricePaise,
        stockQuantity,
        saleStartsAt: saleDate,
        saleEndsAt: saleDate,
    })
    .refine(endsAfterStart, endsAfterStartError);

// Every field is optional. Only the fields sent are changed.
export const updateProductSchema = z
    .object({
        title: title.optional(),
        pricePaise: pricePaise.optional(),
        stockQuantity: stockQuantity.optional(),
        saleStartsAt: saleDate,
        saleEndsAt: saleDate,
        isActive: z.boolean({ error: "isActive must be true or false" }).optional(),
    })
    .refine(endsAfterStart, endsAfterStartError);
