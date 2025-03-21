  // routes/stripe.routes.js

  import express from "express";
  import { auth } from "../middlewares/auth.js";
  import {
    createCustomer,
    createPaymentIntent,
    handleWebhook,
    getPaymentMethods,
    getPaymentHistory,
    refundPayment
  } from "../controllers/stripe.controllers.js";

  const router = express.Router();

  // Customer routes
  router.post("/create-customer", auth, createCustomer);

  // Payment routes
  router.post("/create-payment-intent", auth, createPaymentIntent);
  router.get("/payment-methods", auth, getPaymentMethods);
  router.get("/payment-history", auth, getPaymentHistory);
  router.post("/refund", auth, refundPayment);

  // Webhook route - no auth middleware for webhooks, as they come from Stripe
  // Note: This must use express.raw middleware for body parsing
  router.post("/webhook", express.raw({ type: "application/json" }), handleWebhook);

  export default router;