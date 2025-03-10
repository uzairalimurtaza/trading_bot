import speakeasy from "speakeasy";
import dotenv from "dotenv";

dotenv.config();

export const generateOtp = async () => {
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
