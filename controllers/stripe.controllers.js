

import Stripe from "stripe";
import dotenv from "dotenv";
import StripePayment from "../models/stripe.model.js";
import User from "../models/user.model.js"; 

dotenv.config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);


export const createCustomer = async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }

    // Step 1: Create customer in Stripe
    const customer = await stripe.customers.create({
      name,
      email,
    });

    // Step 2: Update user in MongoDB with stripeCustomerId
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id, // ✅ Make sure req.user.id exists
      { stripeCustomerId: customer.id },
      { new: true } // ✅ Returns updated user data
    );

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({
      success: true,
      customer,
      user: updatedUser // ✅ Send updated user data in response
    });

  } catch (error) {
    console.error("Error creating customer:", error);
    res.status(500).json({ error: error.message });
  }
};


export const createPaymentIntent = async (req, res) => {
  try {
    const { amount, currency, userId, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }

   
    const user = await User.findById(userId || req.user.id);
    
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), 
      currency: currency || "usd",
      payment_method_types: ["card"],
      customer: user?.stripeCustomerId || null,
      description: description || "Payment for services",
      metadata: {
        userId: userId || req.user.id,
      }
    });

    
    const newPayment = new StripePayment({
      userId: userId || req.user.id,
      stripeCustomerId: user?.stripeCustomerId || null,
      paymentIntentId: paymentIntent.id,
      amount,
      currency: currency || "usd",
      status: paymentIntent.status,
      description: description || "Payment for services",
    });

    await newPayment.save();
    
    res.status(200).json({ 
      success: true,
      clientSecret: paymentIntent.client_secret 
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(500).json({ error: error.message });
  }
};


export const getPaymentMethods = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user?.stripeCustomerId) {
      return res.status(404).json({ error: "Customer not found in Stripe" });
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: 'card',
    });

    res.status(200).json({
      success: true,
      paymentMethods: paymentMethods.data,
    });
  } catch (error) {
    console.error("Error retrieving payment methods:", error);
    res.status(500).json({ error: error.message });
  }
};


export const getPaymentHistory = async (req, res) => {
  try {
    const payments = await StripePayment.find({ userId: req.user.id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      payments,
    });
  } catch (error) {
    console.error("Error retrieving payment history:", error);
    res.status(500).json({ error: error.message });
  }
};


export const handleWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

   
    switch (event.type) {
      case "payment_intent.succeeded":
        const paymentIntent = event.data.object;
        await StripePayment.findOneAndUpdate(
          { paymentIntentId: paymentIntent.id },
          { status: "succeeded" }
        );
        break;
      
      case "payment_intent.payment_failed":
        const failedPayment = event.data.object;
        await StripePayment.findOneAndUpdate(
          { paymentIntentId: failedPayment.id },
          { status: "failed" }
        );
        break;

     
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(400).json({ error: `Webhook error: ${err.message}` });
  }
};

// Refund a payment
export const refundPayment = async (req, res) => {
  try {
    const { paymentId, amount } = req.body;

    if (!paymentId) {
      return res.status(400).json({ error: "Payment ID is required" });
    }

    // Get the payment from the database
    const payment = await StripePayment.findById(paymentId);
    
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    // Only allow refunds for successful payments
    if (payment.status !== "succeeded") {
      return res.status(400).json({ 
        error: "Cannot refund a payment that hasn't succeeded" 
      });
    }

    // Create the refund in Stripe
    const refund = await stripe.refunds.create({
      payment_intent: payment.paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined, // Optional partial refund
    });

    // Update payment status in database
    payment.status = amount && amount < payment.amount ? "partially_refunded" : "refunded";
    payment.refundId = refund.id;
    payment.refundedAmount = amount || payment.amount;
    await payment.save();

    res.status(200).json({
      success: true,
      refund,
    });
  } catch (error) {
    console.error("Error processing refund:", error);
    res.status(500).json({ error: error.message });
  }
};