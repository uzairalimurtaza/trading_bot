import UserModel from "../models/user.model.js";
import { validateUser } from "../services/userValidation/verifyUser.js";
import { sendOtpEmail } from "../services/email/sendEmail.js";
import { generateOtp, validateOtp } from "../services/otp/generateOtp.js";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from 'uuid';

export const signUpUser = async (req, res) => {
  const { name, phoneNo, email, password } = req.body;
  if (!(name && phoneNo && email && password)) {
    return res.status(400).json({
      status: false,
      message: "Please provide name, phone number, email, and password",
    });
  }

  try {
    const _email = email.toLowerCase();
    let user = await UserModel.findOne({ email: _email });

    if (user) {
      if (!user.isActive) {
        return res.status(400).json({
          status: false,
          message: "Account is inactive",
        });
      }
      if (user.isVerified) {
        return res.status(400).json({
          status: false,
          message: "User already exists",
        });
      }
    } else {
      // 🚀 Check if user has a wallet account but no real email
      let walletUser = await UserModel.findOne({
        walletKey: { $ne: null },
        email: { $regex: /^dummy@wallet\.com$/, $options: "i" }, // Detect dummy email
      });

      if (walletUser) {
        console.log("Updating wallet-based account with real email/password");
        walletUser.name = name;
        walletUser.phoneNo = phoneNo;
        walletUser.email = _email;
        walletUser.password = password;
        await walletUser.save();
        user = walletUser;
      } else {
        // No wallet user exists → create a new user
        const newUser = new UserModel({
          name,
          phoneNo,
          email: _email,
          password,
        });
        user = await newUser.save();
      }
    }

    // Generate OTP
    const { otp, otpExpiry, success } = generateOtp();
    if (!success) {
      return res.status(400).json({
        status: false,
        message: "Error generating OTP",
      });
    }
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    // Send OTP email
    sendOtpEmail(_email, otp, "Verify Your Email for Signup");

    return res.status(200).json({
      status: true,
      message: "Check your email for OTP verification",
    });

  } catch (error) {
    console.error("Signup Error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
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

    sendOtpEmail(
      email,
      response.otp,
      "Email Verification Code for Trading Bot Registration"
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
    return res.status(400).json({
      status: false,
      message: "Please provide email and password",
    });
  }

  try {
    const _email = email.toLowerCase();
    let user = await UserModel.findOne({ email: _email }).select("+password");

    if (!user) {
      return res.status(400).json({
        status: false,
        message: "User not found",
      });
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({
        status: false,
        message: "Invalid password",
      });
    }

    const token = user.getToken();
    return res.status(200).json({
      status: true,
      message: "Logged in successfully",
      token,
      name: user.name,
      email: user.email,
      walletKey: user.walletKey, // Include walletKey if present
    });

  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
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
      "Password Reset Code for Trading Bot"
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
    sendOtpEmail(email, response.otp, "Password Reset Code for Trading Bot");

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
  const { access_token, newPassword } = req.body;
  if (!(access_token && newPassword)) {
    console.log("Invalid Input");
    return res.status(400).json({
      status: false,
      message:
        "Please ensure that you have send all the required fields ( access_token, newPassword )",
    });
  }
  try {
    console.log("Access token : ", access_token);
    const decoded = jwt.verify(access_token, process.env.JWT_SECRET);
    console.log(decoded);

    let userRecord = await UserModel.findById({ _id: decoded.id }).select(
      "+password"
    );
    if (!userRecord) {
      return res.status(400).json({
        status: false,
        message: "User not found",
      });
    }
    const { success, message, user } = await validateUser(
      userRecord.email,
      false
    );
    if (!success) {
      return res.status(400).json({ status: false, message });
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
    sendOtpEmail(
      email,
      response.otp,
      "Email Verification Code for Trading Bot Login"
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
        "Two-Factor Authentication Code for Trading Bot"
      );
      return res.status(200).json({
        status: true,
        message: "Check your email for OTP.",
      });
    } else {
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
        "Two-Factor Authentication Disablement Verification Code for Trading Bot"
      );

      return res.status(200).json({
        status: true,
        message: "Check your email for OTP.",
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

export const verify2FADisablement = async (req, res) => {
  const { otp } = req.body;
  if (!otp) {
    return res.status(400).json({
      status: false,
      message: "Please provide the OTP",
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

    // Clear OTP and disable 2FA
    user.otp = "";
    user.otpExpiry = "";
    user.is2Factor = false;
    await user?.save();

    return res.status(200).json({
      status: true,
      message: "2FA disabled successfully",
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
      "Two-Factor Authentication Code for Trading Bot"
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

export const connectWallet = async (req, res) => {
  const { walletKey } = req.body;

  if (!walletKey) {
    return res.status(400).json({
      status: false,
      message: "Wallet key is required",
    });
  }

  try {
    // Find the current authenticated user
    const user = await UserModel.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    // Check if this wallet key is already associated with another user
    const existingWalletUser = await UserModel.findOne({ walletKey });
    if (
      existingWalletUser &&
      existingWalletUser._id.toString() !== user._id.toString()
    ) {
      return res.status(400).json({
        status: false,
        message: "This wallet is already connected to another account",
      });
    }

    // Update user with wallet key
    user.walletKey = walletKey;
    await user.save();

    return res.status(200).json({
      status: true,
      message: "Wallet connected successfully",
      walletKey: user.walletKey,
    });
  } catch (error) {
    console.error("Wallet Connection Error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Optional: Method to disconnect wallet
export const disconnectWallet = async (req, res) => {
  try {
    const user = await UserModel.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    if (!user.walletKey) {
      return res.status(400).json({
        status: false,
        message: "No wallet connected",
      });
    }

    // Clear the wallet key
    user.walletKey = null;
    await user.save();

    return res.status(200).json({
      status: true,
      message: "Wallet disconnected successfully",
    });
  } catch (error) {
    console.error("Wallet Disconnection Error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const checkWalletConnection = async (req, res) => {
  try {
    const user = await UserModel.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      status: true,
      walletConnected: !!user.walletKey,
      walletKey: user.walletKey,
    });
  } catch (error) {
    console.error("Wallet Connection Check Error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


export const walletLogin = async (req, res) => {
  const { walletKey, subscribedPlan } = req.body;

  if (!walletKey) {
    return res.status(400).json({
      status: false,
      message: "Wallet key is required",
    });
  }

  try {
    // Use findOneAndUpdate with upsert to avoid race conditions
    let user = await UserModel.findOneAndUpdate(
      { walletKey },
      {
        $setOnInsert: {
          name: `User_${uuidv4().slice(0, 8)}`,
          email: `dummy@wallet.com`,
          password: uuidv4(),
          walletKey,
          isVerified: true,
          role: "User",
          
        },
        $set: {
          subscribedPlan: subscribedPlan
        }
      },
      { 
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );

    const token = user.getToken();
    const isNewUser = user.createdAt.getTime() === user.updatedAt.getTime();

    return res.status(isNewUser ? 201 : 200).json({
      status: true,
      message: isNewUser ? "New user created via wallet" : "Login successful",
      token,
      isNewUser,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        walletKey: user.walletKey,
        subscribedPlan: user.subscribedPlan,
      },
    });

  } catch (error) {
    console.error("Wallet Login Error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


export const updateWalletUser = async (req, res) => {
  const { name, email } = req.body;
  const userId = req.user._id;

  try {
    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found"
      });
    }

    // Check if email is already in use (excluding current user)
    if (email) {
      const existingEmail = await UserModel.findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: userId } 
      });

      if (existingEmail) {
        return res.status(400).json({
          status: false,
          message: "Email already in use"
        });
      }
    }

    // Update user details
    if (name) user.name = name;
    if (email) user.email = email.toLowerCase();

    await user.save();

    return res.status(200).json({
      status: true,
      message: "User profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        walletKey: user.walletKey
      }
    });
  } catch (error) {
    console.error("Update Wallet User Error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
      error: error.message
    });
  }
};
