import express from "express";
const router = express.Router();
import webPush from "../config/webPush.js";

let subscriptions = []; // store in DB in production

router.post("/subscribe", (req, res) => {
  const sub = req.body;
  subscriptions.push(sub); // Save in DB later
  res.status(201).json({ message: "Subscribed successfully!" });
});

router.post("/notify", async (req, res) => {
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
});

export default router;
