import express from "express";

import {
  signUpUser,
  resendOTP,
  verifyOTP,
  loginUser,
  forgotPassword,
  resendForgotPasswordOTP,
  verifyForgotPasswordOTP,
  resetPassword,
  onOFF2Factor,
  resend2FAOTPProfile,
  verify2FAOTPProfile,
  resend2FAOTP,
  verify2FAOTP,
  updatePassword,
} from "../controllers/auth.controllers.js";
import { auth } from "../middlewares/auth.js";

const router = express.Router();

router.post("/signup", signUpUser);
router.post("/resendOTP", resendOTP);
router.post("/verifyOTP", verifyOTP);
router.post("/login", loginUser);

router.post("/forgotPassword", forgotPassword);
router.post("/resendForgotPasswordOTP", resendForgotPasswordOTP);
router.post("/verifyForgotPasswordOTP", verifyForgotPasswordOTP);
router.post("/resetPassword", resetPassword);

router.post("/resend2FAOTP", resend2FAOTP);
router.post("/verify2FAOTP", verify2FAOTP);

router.post("/onOFF2Factor", auth, onOFF2Factor);
router.get("/resend2FAOTPProfile", auth, resend2FAOTPProfile);
router.post("/verify2FAOTPProfile", auth, verify2FAOTPProfile);

router.post("/updatePassword", auth, updatePassword);

export default router;
