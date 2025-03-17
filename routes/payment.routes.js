import express from "express";

import { confirmTransaction } from "../controllers/payment.controllers.js";
import { auth } from "../middlewares/auth.js";

const router = express.Router();

router.post("/confirmTransaction", auth, confirmTransaction);

export default router;
