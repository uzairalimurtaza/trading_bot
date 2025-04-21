// routes/stripe.routes.js

import express from "express";
import { auth } from "../middlewares/auth.js";
import {
  createCheckoutSession,
  successCheckoutSession,
  handleWebhook,
  cancelPlan,
  getUserPlan,
  getPaymentHistory,
} from "../controllers/stripe.controllers.js";

const router = express.Router();

// ============================
// Stripe Customer
// ============================
// router.post("/create-customer", auth, createStripeCustomer);

// ============================
// Checkout / Subscription
// ============================
router.post("/create-payment-intent", auth, createCheckoutSession);
router.get("/success", successCheckoutSession);

// ============================
// Webhook (Stripe events)
// ============================
router.post(
  "/webhook",
  express.raw({ type: "application/json" }), // Needed for Stripe signature verification
  handleWebhook
);

// ============================
// Subscription Management
// ============================
router.put("/cancel-subscription", auth, cancelPlan);
router.get("/user-plan", auth, getUserPlan); // Optional: Get current user’s subscription info
router.get("/payment-history", auth, getPaymentHistory); // Optional: Payment logs

// ============================
// Cancel Redirect Placeholder
// ============================
router.get("/cancel", (req, res) => {
  res.send("Payment was cancelled.");
});

export default router;
