// models/stripe.model.js

import mongoose from "mongoose";

const StripePaymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    stripeCustomerId: { type: String },
    paymentIntentId: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "usd" },
    status: { type: String, required: true },
    description: { type: String },
    refundId: { type: String },
    refundedAmount: { type: Number },
    metadata: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: true }
);

// Index to improve query performance
StripePaymentSchema.index({ userId: 1, createdAt: -1 });
StripePaymentSchema.index({ paymentIntentId: 1 }, { unique: true });

export default mongoose.model("StripePayment", StripePaymentSchema);