import express from "express";
const router = express.Router();
import authRoutes from "./auth.routes.js";
import paymentRoutes from "./payment.routes.js";
import stripeRoutes from "./strip.routes.js"
import notificationRoutes from "./notification.routes.js";
// Define your routes
router.use("/auth", authRoutes);
router.use("/payment", paymentRoutes);
router.use("/stripe", stripeRoutes);
router.use("/notification", notificationRoutes);
export default router;
