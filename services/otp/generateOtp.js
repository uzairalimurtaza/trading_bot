import { validateUser } from "../userValidation/verifyUser.js";
import speakeasy from "speakeasy";
import dotenv from "dotenv";

dotenv.config();

export const generateOtp = () => {
  try {
    const secret = speakeasy.generateSecret({
      length: 20,
    });
    let otp = speakeasy.totp({
      secret: secret.base32,
      encoding: "base32",
    });
    otp = otp.slice(0, 6);

    // getting current time which is in milliseconds by dividing we are converting in seconds
    let OTPExpiryTime = process.env.OTP_EXPIRY_TIME;
    const otpExpiryTime = parseInt(OTPExpiryTime);
    const currentTime = parseInt(new Date().getTime() / 1000);
    const otpExpiry = currentTime + otpExpiryTime;
    console.log("Generated OTP:", otp);
    console.log("OTP Expiry Time:", otpExpiry);
    console.log("Current Time:", currentTime);

    return { otp, otpExpiry, success: true };
  } catch (error) {
    console.error("Error generating OTP : ", error);
    return { success: false, success: false };
  }
};

export const validateOtp = async (email, otp, isLogin) => {
  try {
    const { success, message, user } = await validateUser(email, isLogin);
    if (!success) {
      return res.status(400).json({ success: false, message });
    }

    if (user.otp !== otp) {
      return { success: false, message: "Invalid OTP" };
    }

    const currentTime = Math.floor(Date.now() / 1000); // Convert to seconds
    if (user.otpExpiry < currentTime) {
      return { success: false, message: "OTP is Expired" };
    }

    return { success: true, user };
  } catch (error) {
    console.error("Error in validateOtp:", error);
    return { success: false, message: "Internal Server Error" };
  }
};
