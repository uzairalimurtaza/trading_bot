import express from "express";
const router = express.Router();
import authRoutes from "./auth.routes.js";
import paymentRoutes from "./payment.routes.js";
// Define your routes
router.use("/auth", authRoutes);
router.use("/payment", paymentRoutes);
export default router;
