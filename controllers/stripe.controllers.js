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
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "T-shirt",
            },
            unit_amount: 5000,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: {
        userId: req.user.id, // ✅ Ensure this is included
      },
      shipping_address_collection: {
        allowed_countries: ["US", "CA"],
      },
      success_url: `http://localhost:4005/api/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:4005/api/strip/cancel`,
    });

    console.log(session);
    res.status(200).json({ success: true, url: session.url });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
};

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

    // console.log("Payment successfully recorded:", newPayment);

    // res.status(200).json({
    //   success: true,
    //   message: "Payment successfully recorded",
    //   payment: newPayment,
    // });
    res.send(`
      <html>
        <head>
          <title>Payment Successful</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              padding: 50px;
            }
            .container {
              max-width: 500px;
              margin: 0 auto;
              padding: 20px;
              box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
              border-radius: 10px;
            }
            h1 {
              color: green;
            }
            p {
              font-size: 18px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🎉 Payment Successful!</h1>
            <p>Thank you for your payment of <strong>$${paymentData.amount}</strong>!</p>
            <p>Your transaction has been successfully recorded.</p>
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
