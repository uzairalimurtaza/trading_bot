import express from "express";
const router = express.Router();
import authRoutes from "./auth.routes.js";
// Define your routes
router.use("/auth", authRoutes);
export default router;
