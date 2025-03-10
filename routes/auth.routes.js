import express from "express";

import {
  signUpUser,
  verifyOTP,
  loginUser,
  forgotPassword,
  resetPassword,
  updatePassword,
  onOFF2Factor,
  resendOtp,
} from "../controllers/auth.controllers.js";
import { auth } from "../middlewares/auth.js";

const router = express.Router();

router.post("/signup", signUpUser);
router.post("/login", loginUser);
router.post("/forgotPassword", forgotPassword);
router.post("/resetPassword", resetPassword);
router.post("/updatePassword", auth, updatePassword);
router.post("/onOFF2Factor", auth, onOFF2Factor);
router.post("/resendOtp", resendOtp);
router.post("/verifyOTP", verifyOTP);

export default router;
