// routes/stripe.routes.js

import express from "express";
import {
  subscribeToPush,
  sendPushNotification,
} from "../controllers/notification.controllers.js";

const router = express.Router();


router.post("/subscribe", subscribeToPush);
router.post("/notify", sendPushNotification);

export default router;
