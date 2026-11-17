import { Router } from "express";
import * as productController from "../controllers/product.controller.js";
import { requireAdmin } from "../middlewares/auth.middleware.js";

const router = Router();

// Public
router.get("/", productController.listActive);

// Admin. "/all" must come before "/:id", or Express would treat "all" as an id.
router.get("/all", requireAdmin, productController.listAll);
router.post("/", requireAdmin, productController.create);
router.patch("/:id", requireAdmin, productController.update);
router.delete("/:id", requireAdmin, productController.deactivate);
router.post("/:id/load-stock", requireAdmin, productController.loadStock);

// Public
router.get("/:id", productController.getById);
router.get("/:id/stock", productController.getStock);

export default router;
