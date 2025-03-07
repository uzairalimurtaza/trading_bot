import express from "express";

import {
  signUpUser,
  verifyOTP,
  loginUser,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controllers.js";
import { auth } from "../middlewares/auth.js";

const router = express.Router();

router.post("/signup", signUpUser);
router.post("/verifyOTP", verifyOTP);
router.post("/login", loginUser);
router.post("/forgotPassword", forgotPassword);
router.post("/resetPassword", resetPassword);

export default router;
