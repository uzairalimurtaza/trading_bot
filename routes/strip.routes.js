// routes/stripe.routes.js

import express from "express";
import { auth } from "../middlewares/auth.js";
import {
  createCustomer,
  createCheckoutSession,
  successCheckoutSession,
  handleWebhook,
} from "../controllers/stripe.controllers.js";


const router = express.Router();

// Customer routes
router.post("/create-customer", auth, createCustomer);

// Payment routes

router.post("/create-payment-intent", auth, createCheckoutSession);

router.get("/success", successCheckoutSession);

router.get("/cancel", (req, res) => {
  res.send("paymentSend  cancel!");
});

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook
);
export default router;
