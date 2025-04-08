import webPush from "../config/webPush.js";

let subscriptions = [];

export const subscribeToPush = (req, res) => {
  const subscription = req.body;

  // Optional: Check if subscription already exists
  const exists = subscriptions.find(sub => sub.endpoint === subscription.endpoint);
  if (!exists) {
    subscriptions.push(subscription);
  }

  res.status(201).json({ message: "Subscribed successfully!" });
};

export const sendPushNotification = async (req, res) => {
  const payload = JSON.stringify({
    title: "📢 New SOL Transfer",
    body: "A new transaction was confirmed!",
  });

  try {
    const results = await Promise.all(
      subscriptions.map((sub) =>
        webPush.sendNotification(sub, payload).catch((err) => {
          console.error("Push error:", err);
        })
      )
    );
    res.status(200).json({ success: true, results });
  } catch (err) {
    console.error("Notification error:", err);
    res.status(500).json({ success: false });
  }
};
