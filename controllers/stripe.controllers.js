import Stripe from "stripe";
import dotenv from "dotenv";
import StripePayment from "../models/stripe.model.js";
import User from "../models/user.model.js";

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const FRONT_END_URL = process.env.FRONT_END_URL || "http://localhost:3000";
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:4005";
// ========================================================
// Create Stripe Customer for Authenticated User
// ========================================================
export const createCustomer = async (email, name) => {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      description: "New Trading Bot User",
    });

    return {
      success: true,
      customer,
    };
  } catch (error) {
    console.error("Error creating Stripe customer:", error.message);
    return {
      success: false,
      message: error.message,
    };
  }
};

// export const createCustomer = async (req, res) => {
//   try {
//     const { name, email } = req.body;
//     if (!name || !email) {
//       return res.status(400).json({ error: "Name and email are required" });
//     }

//     // Create a new customer in Stripe
//     const customer = await stripe.customers.create({ name, email });

//     // Update the user in DB with Stripe customer ID
//     const updatedUser = await User.findByIdAndUpdate(
//       req.user.id,
//       { stripeCustomerId: customer.id },
//       { new: true }
//     );

//     if (!updatedUser) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     res.status(200).json({
//       success: true,
//       message: "Customer created successfully",
//       customer,
//       user: updatedUser,
//     });
//   } catch (error) {
//     console.error("Error creating customer:", error);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// };


// ========================================================
// Create Stripe Subscription Checkout Session
// ========================================================
export const createCheckoutSession = async (req, res) => {
  try {
    const { plan } = req.body;
    const userId = req.user.id;

    if (!plan) {
      return res.status(400).json({ error: "Plan is required" });
    }

    const priceIds = {
      basic: process.env.STRIPE_BASIC_PRICE_ID,
      advanced: process.env.STRIPE_ADVANCED_PRICE_ID,
      elite: process.env.STRIPE_ELITE_PRICE_ID,
    };

    const selectedPriceId = priceIds[plan];

    if (!selectedPriceId) {
      return res.status(400).json({ error: "Invalid plan selected" });
    }

    const user = await User.findById(userId);
    if (!user || !user.stripeCustomerId) {
      return res.status(400).json({ error: "User must have a Stripe customer ID" });
    }

    // Create subscription session
    const session = await stripe.checkout.sessions.create({
      customer: user.stripeCustomerId,
      mode: "subscription",
      line_items: [
        {
          price: selectedPriceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId: userId,
        plan: plan,
      },
      success_url: `${API_BASE_URL}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      // success_url: `https://tradingbotapi.thecbt.live/api/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONT_END_URL}`,
    });

    res.status(200).json({ success: true, url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
};

// ========================================================
// Handle Successful Checkout Redirect (optional fallback)
// ========================================================
export const successCheckoutSession = async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.query.session_id, {
      expand: ["subscription"],
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Retrieve paymentIntentId from invoice if not directly available
    let paymentIntentId = session.payment_intent;

    if (!paymentIntentId && session.subscription) {
      const subscription = session.subscription;
      const invoice = await stripe.invoices.retrieve(subscription.latest_invoice);
      paymentIntentId = invoice.payment_intent;
    }

    // Save to DB
    const paymentData = {
      userId: session.metadata.userId,
      stripeCustomerId: session.customer || null,
      paymentIntentId: paymentIntentId || "N/A",
      amount: session.amount_total / 100,
      currency: session.currency,
      status: session.payment_status,
      description: session.metadata?.description || "Subscription Payment",
      metadata: session.metadata,
    };

    await StripePayment.create(paymentData);

    // Set plan info in User model
    const plan = session.metadata?.plan;
    const planStartDate = new Date();
    const planEndDate = new Date();
    planEndDate.setDate(planStartDate.getDate() + 30); // assuming 30-day plan

    await User.findByIdAndUpdate(session.metadata.userId, {
      subscribedPlan: plan,
      planStartDate,
      planEndDate,
    });

    res.redirect(`${FRONT_END_URL}/setting`);
  } catch (error) {
    console.error("Error handling success:", error);
    res.status(500).json({ error: error.message });
  }
};


// ========================================================
// Stripe Webhook: Subscription Events
// ========================================================
export const handleWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const plan = session.metadata?.plan || null;
      const planStartDate = new Date();
      const planEndDate = new Date();
      planEndDate.setDate(planStartDate.getDate() + 30);

      // Save Payment Data
      await StripePayment.create({
        userId: session.metadata.userId,
        stripeCustomerId: session.customer,
        paymentIntentId: session.payment_intent || null,
        amount: session.amount_total / 100,
        currency: session.currency,
        status: session.payment_status,
        description: plan ? `${plan} Subscription` : "Subscription",
        metadata: session.metadata,
      });

      // Update user subscription
      await User.findByIdAndUpdate(session.metadata.userId, {
        subscribedPlan: plan,
        stripeCustomerId: session.customer,
      });
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(400).json({ error: `Webhook error: ${err.message}` });
  }
};

// ========================================================
// Cancel Current Plan (manual override)
// ========================================================
export const cancelPlan = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ error: "User not found" });

    // Clear plan from DB (manual only — does not cancel Stripe sub)
    user.subscribedPlan = null;
    user.planStartDate = null;
    user.planEndDate = null;
    await user.save();

    res.status(200).json({ message: "Plan canceled successfully" });
  } catch (error) {
    console.error("Error canceling plan:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// ========================================================
// Optional: Get User Plan Info
// ========================================================
export const getUserPlan = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "subscribedPlan planStartDate planEndDate"
    );

    if (!user) return res.status(404).json({ error: "User not found" });

    res.status(200).json({
      subscribedPlan: user.subscribedPlan,
      planStartDate: user.planStartDate,
      planEndDate: user.planEndDate,
    });
  } catch (error) {
    console.error("Error fetching plan:", error);
    res.status(500).json({ error: "Failed to fetch user plan" });
  }
};

// ========================================================
// Optional: Get Payment History
// ========================================================
export const getPaymentHistory = async (req, res) => {
  try {
    const payments = await StripePayment.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(payments);
  } catch (error) {
    console.error("Error fetching payment history:", error);
    res.status(500).json({ error: "Failed to fetch payment history" });
  }
};
