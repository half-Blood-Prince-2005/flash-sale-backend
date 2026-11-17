import { Router } from "express";
import * as orderController from "../controllers/order.controller.js";
import { requireUser, requireAdmin } from "../middlewares/auth.middleware.js";

const router = Router();

// Buyer
router.post("/", requireUser, orderController.purchase);
router.get("/mine", requireUser, orderController.listMine);

// Admin. These must come before "/:id", or Express would treat "all" as an id.
router.get("/all", requireAdmin, orderController.listAll);
router.get("/product/:productId", requireAdmin, orderController.listByProduct);

// Buyer: one of their own orders
router.get("/:id", requireUser, orderController.getById);

export default router;
