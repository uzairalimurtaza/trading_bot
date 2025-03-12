import UserModel from "../models/user.model.js";
import { validateUser } from "../services/userValidation/verifyUser.js";
import { sendOtpEmail } from "../services/email/sendEmail.js";
import { generateOtp, validateOtp } from "../services/otp/generateOtp.js";
import jwt from "jsonwebtoken";

export const signUpUser = async (req, res) => {
  const { name, phoneNo, email, password } = req.body;
  if (!(name && phoneNo && email && password)) {
    console.log("invalid Input");
    return res.status(400).json({
      status: false,
      message: `Please ensure that you are sending all the required fields ( name, phoneNo, email, password )`,
    });
  }
  try {
    const _email = email.toLowerCase();
    console.log("user email : ", _email);

    let user = await UserModel.findOne({
      email: _email,
    });

    if (user) {
      console.log("user already exists");
      if (!user.isActive) {
        console.log("User not Active");
        return res.status(400).json({
          status: false,
          message: "Account deleted",
        });
      }
      if (user.isVerified) {
        return res.status(400).json({
          status: false,
          message: "User already exists",
        });
      }
    }
    if (!user) {
      const createUser = new UserModel({
        name: name,
        phoneNo: phoneNo,
        email: _email,
        password: password,
      });
      user = await createUser.save();
      console.log("user created : ", createUser);
    }
    // ----------------------------------------------------------------
    const { otp, otpExpiry, success } = generateOtp();
    if (!success) {
      return res.status(400).json({
        status: false,
        message: "Error while generating OTP",
      });
    }
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    // ----------------------------------------------------------------
    sendOtpEmail(_email, otp, "Your Login Verification Code");

    return res.status(200).json({
      status: true,
      message: "Check your email for OTP.",
    });
  } catch (error) {
    console.log("Error : ", error);
    return res.status(500).json({
      status: false,
      message: error,
    });
  }
};
export const resendOTP = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    console.log("Invalid input");
    return res.status(400).json({
      status: false,
      message: `Please ensure that you are sending all the required fields ( email )`,
    });
  }
  try {
    const { success, message, user } = await validateUser(email, true);
    if (!success) {
      return res.status(400).json({ status: false, message });
    }
    const response = generateOtp();
    if (!response.success) {
      return res.status(400).json({
        status: false,
        message: "Error while generating OTP",
      });
    }
    user.otp = response.otp;
    user.otpExpiry = response.otpExpiry;
    await user.save();

    sendOtpEmail(email, response.otp, "Your Login Verification Code");

    return res.status(200).json({
      status: true,
      message: "Check your email for OTP.",
    });
  } catch (error) {
    console.log("Error : ", error);
    return res.status(500).json({
      status: false,
      message: error,
    });
  }
};
export const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;
  if (!(email && otp)) {
    return res.status(400).json({
      status: false,
      message:
        "Please ensure you are sending all the required fields in the request body ( email, otp)",
    });
  }
  try {
    const { success, message, user } = await validateOtp(email, otp, true);
    if (!success) {
      return res.status(400).json({ status: false, message });
    }
    user.otp = "";
    user.otpExpiry = "";
    user.isVerified = true;
    await user?.save();
    return res.status(200).json({
      status: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    console.log("Error : ", error);
    return res.status(500).json({
      status: false,
      message: error,
    });
  }
};
export const loginUser = async (req, res) => {
  const { email, password } = req.body;
  if (!(email && password)) {
    console.log("Invalid input");
    return res.status(400).json({
      status: false,
      message: `Please ensure that you are sending all the required fields ( email, password )`,
    });
  }
  try {
    const _email = email.toLowerCase();
    let userRecord = await UserModel.findOne({ email: _email }).select(
      "+password"
    );
    const { success, message, user } = await validateUser(email, false);
    if (!success) {
      return res.status(400).json({ status: false, message });
    }

    let result = await userRecord.comparePassword(password);
    if (!result) {
      console.log("Invalid password");
      return res.status(400).json({
        status: false,
        message: "Invalid password",
      });
    }

    if (userRecord.is2Factor) {
      const { otp, otpExpiry, success } = generateOtp();
      if (!success) {
        return res.status(400).json({
          status: false,
          message: "Error while generating OTP",
        });
      }
      userRecord.otp = otp;
      userRecord.otpExpiry = otpExpiry;
      await userRecord.save();
      sendOtpEmail(_email, otp, "Your OTP for Two-Factor Authentication.");

      return res.status(200).json({
        status: true,
        message: "Check your email for OTP .",
        is2Factor: userRecord.is2Factor,
      });
    } else {
      const token = user.getToken();
      return res.status(200).json({
        status: true,
        message: "Logged in successfully",
        token: token,
        name: user.name,
        email: user.email,
        is2Factor: user.is2Factor,
        ...user._doc,
      });
    }
  } catch (error) {
    console.log("Error : ", error);
    return res.status(500).json({
      status: false,
      message: error,
    });
  }
};
export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({
      status: false,
      message: `Please ensure that you are sending all the required fields ( email )`,
    });
  }
  try {
    const { success, message, user } = await validateUser(email, false);
    if (!success) {
      return res.status(400).json({ status: false, message });
    }
    const response = generateOtp();
    if (!response.success) {
      return res.status(400).json({
        status: false,
        message: "Error while generating OTP",
      });
    }
    user.otp = response.otp;
    user.otpExpiry = response.otpExpiry;
    await user.save();

    sendOtpEmail(
      user.email,
      response.otp,
      "Your Reset Password Verification Code"
    );

    const token = user.getToken();
    return res.status(200).json({
      status: true,
      message: "Email send for password reset",
      token: token,
    });
  } catch (error) {
    console.log("Error : ", error);
    return res.status(500).json({
      status: false,
      message: error,
    });
  }
};
export const resendForgotPasswordOTP = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    console.log("Invalid input");
    return res.status(400).json({
      status: false,
      message: `Please ensure that you are sending all the required fields ( email )`,
    });
  }
  try {
    const { success, message, user } = await validateUser(email, false);
    if (!success) {
      return res.status(400).json({ status: false, message });
    }
    const response = generateOtp();
    if (!response.success) {
      return res.status(400).json({
        status: false,
        message: "Error while generating OTP",
      });
    }
    user.otp = response.otp;
    user.otpExpiry = response.otpExpiry;
    await user.save();
    sendOtpEmail(email, response.otp, "Your Reset Password Verification Code");

    return res.status(200).json({
      status: true,
      message: "Check your email for OTP.",
    });
  } catch (error) {
    console.log("Error : ", error);
    return res.status(500).json({
      status: false,
      message: error,
    });
  }
};
export const verifyForgotPasswordOTP = async (req, res) => {
  const { email, otp } = req.body;
  if (!(email && otp)) {
    return res.status(400).json({
      status: false,
      message:
        "Please ensure you are sending all the required fields in the request body ( email, otp)",
    });
  }
  try {
    const { success, message, user } = await validateOtp(email, otp, false);
    if (!success) {
      return res.status(400).json({ status: false, message });
    }
    user.otp = "";
    user.otpExpiry = "";
    await user?.save();
    return res.status(200).json({
      success: true,
      msg: "OTP verified successfully",
    });
  } catch (error) {
    console.log("Error : ", error);
    return res.status(500).json({
      success: false,
      message: error,
    });
  }
};
export const resetPassword = async (req, res) => {
  const { access_token, oldPassword, newPassword } = req.body;
  if (!(access_token && oldPassword && newPassword)) {
    console.log("Invalid Input");
    return res.status(400).json({
      status: false,
      message:
        "Please ensure that you have send all the required fields ( access_token, oldPassword, newPassword )",
    });
  }
  try {
    console.log("Access token : ", access_token);
    const decoded = jwt.verify(access_token, process.env.JWT_SECRET);
    console.log(decoded);

    let userRecord = await UserModel.findById({ _id: decoded.id }).select(
      "+password"
    );
    const { success, message, user } = await validateUser(
      userRecord.email,
      false
    );
    if (!success) {
      return res.status(400).json({ status: false, message });
    }

    const isMatch = await userRecord.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({
        status: false,
        message: "Incorrect Password",
      });
    }
    userRecord.password = newPassword;
    await userRecord.save();
    return res.status(200).json({
      status: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.log("Error : ", error);
    return res.status(500).json({
      status: false,
      message: error,
    });
  }
};
export const resend2FAOTP = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    console.log("Invalid input");
    return res.status(400).json({
      status: false,
      message: `Please ensure that you are sending all the required fields ( email )`,
    });
  }
  try {
    const { success, message, user } = await validateUser(email, false);
    if (!success) {
      return res.status(400).json({ status: false, message });
    }
    const response = generateOtp();
    if (!response.success) {
      return res.status(400).json({
        status: false,
        message: "Error while generating OTP",
      });
    }
    user.otp = response.otp;
    user.otpExpiry = response.otpExpiry;
    await user.save();
    sendOtpEmail(email, response.otp, "Your OTP for Two-Factor Authentication");
    return res.status(200).json({
      status: true,
      message: "Check your email for OTP.",
    });
  } catch (error) {
    console.log("Error : ", error);
    return res.status(500).json({
      status: false,
      message: error,
    });
  }
};
export const verify2FAOTP = async (req, res) => {
  const { email, otp } = req.body;
  if (!(email && otp)) {
    return res.status(400).json({
      status: false,
      message:
        "Please ensure you are sending all the required fields in the request body ( email, otp)",
    });
  }
  try {
    const { success, message, user } = await validateOtp(email, otp, false);
    if (!success) {
      return res.status(400).json({ status: false, message });
    }
    user.otp = "";
    user.otpExpiry = "";
    await user?.save();

    const token = user.getToken();
    console.log("token : ", token);
    return res.status(200).json({
      sstatus: true,
      message: "Logged in successfully",
      token: token,
      name: user.name,
      email: user.email,
      is2Factor: user.is2Factor,
      ...user._doc,
    });
  } catch (error) {
    console.log("Error : ", error);
    return res.status(500).json({
      success: false,
      msg: "OTP verification error ",
      error,
    });
  }
};

export const onOFF2Factor = async (req, res) => {
  const { type } = req.body;
  if (!type) {
    console.log("Invalid Input");
    return res.status(400).json({
      status: false,
      message: `Please ensure that you have send all the required fields ( type )`,
    });
  }
  try {
    if (type == "true") {
      const { otp, otpExpiry, success } = generateOtp();
      if (!success) {
        return res.status(400).json({
          status: false,
          message: "Error while generating OTP",
        });
      }
      req.user.otp = otp;
      req.user.otpExpiry = otpExpiry;
      await req.user.save();

      sendOtpEmail(
        req.user.email,
        otp,
        "Your Two-Factor Authentication Verification Code"
      );
      return res.status(200).json({
        status: true,
        message: "Check your email for OTP.",
      });
    } else {
      req.user.is2Factor = false;
      await req.user.save();
      return res.status(200).json({
        status: true,
        message: "2FA disabled successfully",
        user: req.user,
      });
    }
  } catch (error) {
    console.log("Error : ", error);
    return res.status(500).json({
      status: false,
      msg: "Internal server error",
    });
  }
};
export const resend2FAOTPProfile = async (req, res) => {
  try {
    const { otp, otpExpiry, success } = generateOtp();
    if (!success) {
      return res.status(400).json({
        status: false,
        message: "Error while generating OTP",
      });
    }
    req.user.otp = otp;
    req.user.otpExpiry = otpExpiry;
    await req.user.save();

    sendOtpEmail(
      req.user.email,
      otp,
      "Your Two-Factor Authentication Verification Code"
    );
    return res.status(200).json({
      status: true,
      message: "Check your email for OTP.",
    });
  } catch (error) {
    console.log("Error : ", error);
    return res.status(500).json({
      status: false,
      message: error,
    });
  }
};
export const verify2FAOTPProfile = async (req, res) => {
  const { otp } = req.body;
  if (!otp) {
    return res.status(400).json({
      status: false,
      message:
        "Please ensure you are sending all the required fields in the request body (otp)",
    });
  }
  try {
    const { success, message, user } = await validateOtp(
      req.user.email,
      otp,
      false
    );
    if (!success) {
      return res.status(400).json({ status: false, message });
    }
    user.otp = "";
    user.otpExpiry = "";
    user.is2Factor = true;
    await user?.save();
    return res.status(200).json({
      status: true,
      message: "2FA enabled successfully",
      user: user,
    });
  } catch (error) {
    console.log("Error : ", error);
    return res.status(500).json({
      status: false,
      message: error,
    });
  }
};
export const updatePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!(oldPassword && newPassword)) {
    console.log("Invalid Input");
    return res.status(400).json({
      status: false,
      message:
        "Please ensure that you have send all the required fields ( oldPassword, newPassword )",
    });
  }
  try {
    const user = await UserModel.findById(req.user._id).select("+password");
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({
        status: false,
        message: "Incorrect Password",
      });
    }
    user.password = newPassword;
    await user.save();
    return res.status(200).json({
      status: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.log("Error : ", error);
    return res.status(500).json({
      status: false,
      message: error,
    });
  }
};
