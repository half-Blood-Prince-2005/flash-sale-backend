import express from "express";
import helmet from "helmet";
import { env } from "./src/config/env.js";
import authRoutes from "./src/routes/auth.routes.js";
import productRoutes from "./src/routes/product.routes.js";

import { notFound, errorHandler } from "./src/middlewares/errorHandler.js";

const app = express();
app.use(helmet());
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok", instance: env.instanceId }));

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;