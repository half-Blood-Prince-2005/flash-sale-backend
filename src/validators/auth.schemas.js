import { z } from "zod";

// "Email is required" when the field is missing, "Email must be text" when it
// was sent with the wrong type, such as a number.
const requiredString = (label) =>
    z.string({
        error: (issue) => (issue.input === undefined ? `${label} is required` : `${label} must be text`),
    });

// Lowercased and trimmed here so the rest of the app only ever sees one form.
// 255 matches the email column size.
const email = requiredString("Email")
    .trim()
    .toLowerCase()
    .max(255, { error: "Email must be at most 255 characters" })
    .pipe(z.email({ error: "Enter a valid email address" }));

// bcrypt only uses the first 72 bytes of a password and ignores the rest.
// Counting bytes, not characters, matters for emoji and non-Latin text.
const maxBcryptBytes = (p) => Buffer.byteLength(p, "utf8") <= 72;

const newPassword = requiredString("Password")
    .min(8, { error: "Password must be at least 8 characters" })
    .refine(maxBcryptBytes, { error: "Password is too long" });

// Login doesn't re-check strength rules, so older accounts can still sign in
// if the rules get stricter later.
const existingPassword = requiredString("Password")
    .min(1, { error: "Password is required" })
    .refine(maxBcryptBytes, { error: "Password is too long" });

const refreshToken = requiredString("Refresh token")
    .min(1, { error: "Refresh token is required" });

// Unknown fields are dropped, so a client can't sneak in something like a role.
export const registerSchema = z.object({ email, password: newPassword });
export const loginSchema = z.object({ email, password: existingPassword });
export const refreshSchema = z.object({ refreshToken });
export const logoutSchema = z.object({ refreshToken });
