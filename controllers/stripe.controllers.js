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
      user: updatedUser, // ✅ Send updated user data in response
    });
  } catch (error) {
    console.error("Error creating customer:", error);
    res.status(500).json({ error: error.message });
  }
};

export const createCheckoutSession = async (req, res) => {
  try {
    const { plan } = req.body;

    if (!plan) {
      return res.status(400).json({ error: "Plan is required" });
    }

    const plans = {
      basic: { name: "Basic Plan", price: 1000 }, // $10
      advanced: { name: "advanced Plan", price: 2000 }, // $20
      elite: { name: "Elite Plan", price: 3000 }, // $30
    };

    if (!plans[plan]) {
      return res.status(400).json({ error: "Invalid plan selected" });
    }

    const selectedPlan = plans[plan];
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: selectedPlan.name,
            },
            unit_amount: selectedPlan.price,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: {
        userId: req.user.id, // ✅ Ensure this is included
        plan: plan,
      },
      shipping_address_collection: {
        allowed_countries: ["US", "CA"],
      },
      success_url: `https://tradingbotapi.thecbt.live/api/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      // success_url: `http://localhost:4005/api/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://tradingbot-sable.vercel.app/`,
    });

    console.log(session);
    res.status(200).json({ success: true, url: session.url });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
};

import UserModel from "../models/user.model.js"; // make sure this is imported

export const successCheckoutSession = async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(
      req.query.session_id
    );

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const paymentData = {
      userId: session.metadata.userId,
      stripeCustomerId: session.customer || null,
      paymentIntentId: session.payment_intent || null,
      amount: session.amount_total / 100,
      currency: session.currency,
      status: session.payment_status,
      description: session.metadata?.description || "No description",
      metadata: session.metadata || {},
      shippingDetails: session.shipping_details
        ? {
            name: session.shipping_details.name,
            address: {
              city: session.shipping_details.address.city,
              country: session.shipping_details.address.country,
              line1: session.shipping_details.address.line1,
              line2: session.shipping_details.address.line2 || null,
              postal_code: session.shipping_details.address.postal_code,
              state: session.shipping_details.address.state,
            },
          }
        : null,
      customerDetails: session.customer_details
        ? {
            name: session.customer_details.name,
            email: session.customer_details.email,
            phone: session.customer_details.phone || null,
            address: {
              city: session.customer_details.address.city,
              country: session.customer_details.address.country,
              line1: session.customer_details.address.line1,
              line2: session.customer_details.address.line2 || null,
              postal_code: session.customer_details.address.postal_code,
              state: session.customer_details.address.state,
            },
          }
        : null,
    };

    const newPayment = await StripePayment.create(paymentData);

    // 🎯 Add Plan Assignment to the User
    const plan = session.metadata?.plan || null; // assuming this was passed in metadata
    if (plan) {
      const planStartDate = new Date();
      const planEndDate = new Date();
      planEndDate.setDate(planStartDate.getDate() + 30); // 30-day membership

      await UserModel.findByIdAndUpdate(session.metadata.userId, {
        subscribedPlan: plan,
        stripeCustomerId: session.customer || null,
        planStartDate,
        planEndDate,
      });
    }

    res.send(`
      <html>
        <head>
          <title>Payment Successful</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 50px;
              background-color: #f9f9f9;
            }
            .container {
              max-width: 500px;
              margin: 0 auto;
              padding: 30px;
              background-color: #ffffff;
              box-shadow: 0px 0px 15px rgba(0, 0, 0, 0.1);
              border-radius: 12px;
            }
            h1 {
              color: #2ecc71;
            }
            p {
              font-size: 18px;
              margin: 15px 0;
            }
            .btn {
              margin-top: 30px;
              display: inline-block;
              background-color: #4a90e2;
              color: white;
              padding: 12px 24px;
              font-size: 16px;
              font-weight: 600;
              text-decoration: none;
              border-radius: 8px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              transition: background-color 0.3s ease;
            }
            .btn:hover {
              background-color: #357ab8;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🎉 Payment Successful!</h1>
            <p>Thank you for your payment of <strong>$${paymentData.amount}</strong>!</p>
            <p>Your transaction has been successfully recorded.</p>
            <a href="https://trading-bot-seven-plum.vercel.app/setting" class="btn">
              Go to Account Settings
            </a>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error saving payment data:", error);
    res.status(500).json({
      error: error.message,
      details: error.toString(),
      stack: error.stack,
    });
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
      case "checkout.session.completed":
        const session = event.data.object;
        const paymentIntentId = session.payment_intent;

        await StripePayment.create({
          paymentIntentId,
          userId: session.metadata.userId, // Pass userId when creating session
          amount: session.amount_total / 100,
          currency: session.currency,
          status: "succeeded",
          stripeCustomerId: session.customer,
        });

        break;
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(400).json({ error: `Webhook error: ${err.message}` });
  }
};

export const cancelPlan = async (req, res) => {
  try {
    const userId = req.user.id; // Get the user ID from the request
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    // if (!user.stripeCustomerId) {
    //   return res.status(400).json({ error: "User has no Stripe customer ID" });
    // }
    // const subscriptions = await stripe.subscriptions.list({
    //   customer: user.stripeCustomerId,
    //   status: "active",
    // });
    // if (subscriptions.data.length === 0) {
    //   return res.status(400).json({ error: "No active subscriptions found" });
    // }
    // const subscriptionId = subscriptions.data[0].id;
    // await stripe.subscriptions.del(subscriptionId);
    user.subscribedPlan = null;
    user.planStartDate = null;
    user.planEndDate = null;
    await user.save();
    res.status(200).json({ message: "Plan canceled successfully" });
  }
  catch (error) {
    console.error("Error canceling plan:", error);
    res.status(500).json({ error: error.message });
  } 
}
// export const getPaymentHistory = async (req, res) => {
//   try {
//     const userId = req.user.id; // Get the user ID from the request
//     const payments = await StripePayment.find({ userId }).sort({ createdAt: -1 });
//     res.status(200).json(payments);
//   } catch (error) {
//     console.error("Error fetching payment history:", error);
//     res.status(500).json({ error: error.message });
//   }
// };
// export const getUserPlan = async (req, res) => {
//   try {
//     const userId = req.user.id; // Get the user ID from the request
//     const user = await User.findById(userId).select("subscribedPlan planStartDate planEndDate");
//     if (!user) {
//       return res.status(404).json({ error: "User not found" });
//     }
//     res.status(200).json({
//       subscribedPlan: user.subscribedPlan,
//       planStartDate: user.planStartDate,
//       planEndDate: user.planEndDate,
//     });
//   }
//   catch (error) {
//     console.error("Error fetching user plan:", error);
//     res.status(500).json({ error: error.message });
//   }
// }

