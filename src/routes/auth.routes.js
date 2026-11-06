import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";

const router = Router();

// Public: none of these need an access token.
// Refresh and logout prove identity with the refresh token in the body.
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);

export default router;
