import UserModel from "../models/user.model.js";
import { sendOtpEmail } from "../services/email/sendEmail.js";
import { generateOtp } from "../services/otp/generateOtp.js";

import speakeasy from "speakeasy";
import jwt from "jsonwebtoken";

export const signUpUser = async (req, res) => {
  console.log("--------");
  console.log("Signup user api called ");
  console.log("--------");

  const { name, phoneNo, email, password } = req.body;
  // sanity check
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
    const { otp, otpExpiry, success } = await generateOtp();

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
    const response = await sendOtpEmail(
      _email,
      otp,
      "Your Login Verification Code"
    );
    if (!response.success) {
      return res.status(500).json({
        status: false,
        message: "Error while sending email",
      });
    }
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

export const loginUser = async (req, res) => {
  console.log("--------");
  console.log("Login user api called ");
  console.log("--------");

  const { email, password } = req.body;
  // sanity check
  if (!(email && password)) {
    console.log("Invalid input");
    return res.status(400).json({
      status: false,
      message: `Please ensure that you are sending all the required fields ( email, password )`,
    });
  }
  try {
    const _email = email.toLowerCase();
    console.log("user email : ", _email);
    let user = await UserModel.findOne({ email: _email }).select("+password");

    if (!user) {
      console.log("User not registered");
      return res.status(400).json({
        status: false,
        message: "User not registered",
      });
    }
    if (!user.isVerified) {
      console.log(
        "Your account is not verified. Please sign up again to complete the verification process"
      );
      return res.status(400).json({
        status: false,
        message:
          "Your account is not verified. Please sign up again to complete the verification process",
      });
    }
    if (!user.isActive) {
      console.log("User not Active");
      return res.status(400).json({
        status: false,
        message: "Account deleted",
      });
    }
    console.log("user : ", user);

    // ----------------------------------------------------------------
    let result = await user.comparePassword(password);
    console.log(result);
    if (!result) {
      console.log("Invalid password");
      return res.status(400).json({
        status: false,
        message: "Invalid password",
      });
    }
    // ----------------------------------------------------------------
    if (user.is2Factor) {
      // Generate an OTP
      const secret = speakeasy.generateSecret({
        length: 20,
      });
      let otp = speakeasy.totp({
        secret: secret.base32,
        encoding: "base32",
      });
      otp = otp.slice(0, 6);
      const otpExpiryTime = parseInt(process.env.OTP_EXPIRY_TIME);
      const currentTime = parseInt(new Date().getTime() / 1000);
      const otpExpiry = currentTime + otpExpiryTime;
      console.log("OTP Expiry Time: ", otpExpiry);
      console.log("Current Time: ", currentTime);
      user.otp = otp;
      user.otpExpiry = otpExpiry;
      await user?.save();
      console.log("Otp saved in Database .");

      let mailOptions = {
        from: process.env.SMTP_MAIL,
        to: user.email,
        subject: "Your OTP for Two-Factor Authentication.",
        html: `<p>Your One-Time Password (OTP) is: <strong>${otp}</strong></p>
             <p>This OTP is required to verify your email address and ensure the security of your account. Please enter this code in the designated field on the verification page. For added security, this OTP is valid for a limited time only.</p>
             <p>If you did not request this verification, you can safely ignore this email.</p>
             <p>Best regards,<br>Trading Bot Team</p>`,
      };
      const response = await sendMail(mailOptions);
      console.log("email : ", response);

      return res.status(200).json({
        status: true,
        message: "Check your email for OTP .",
        is2Factor: user.is2Factor,
      });
    } else {
      user = await UserModel.findOne({ email: _email });
      const token = user.getToken();
      console.log("token : ", token);
      console.log("Logged in successfully");
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
  console.log("--------");
  console.log("Forgot password api called ");
  console.log("--------");

  const { email } = req.body;
  // sanity check
  if (!email) {
    return res.status(400).json({
      status: false,
      message: `Please ensure that you are sending all the required fields ( email )`,
    });
  }
  try {
    const _email = email.toLowerCase();
    console.log("user email : ", _email);
    let user = await UserModel.findOne({ email: _email });
    if (!user) {
      console.log("User not registered");
      return res.status(400).json({
        status: false,
        message: "User not registered",
      });
    }

    if (!user.isVerified) {
      console.log(
        "Your account is not verified. Please sign up again to complete the verification process"
      );
      return res.status(400).json({
        status: false,
        message:
          "Your account is not verified. Please sign up again to complete the verification process",
      });
    }

    if (!user.isActive) {
      console.log("User not Active");
      return res.status(400).json({
        status: false,
        message: "Account deleted",
      });
    }
    // otp generation
    const secret = speakeasy.generateSecret({
      length: 20,
    });
    let otp = speakeasy.totp({
      secret: secret.base32,
      encoding: "base32",
    });
    otp = otp.slice(0, 6);
    console.log("storing otp ", otp);
    // getting current time which is in milliseconds by dividing we are converting in seconds
    let OTPExpiryTime = process.env.OTP_EXPIRY_TIME;
    const otpExpiryTime = parseInt(OTPExpiryTime);
    const currentTime = parseInt(new Date().getTime() / 1000);
    const otpExpiry = currentTime + otpExpiryTime;
    console.log("OTP Expiry Time: ", otpExpiry);
    console.log("Current Time: ", currentTime);
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    let mailOptions = {
      from: process.env.SMTP_MAIL,
      to: email,
      subject: "Your Reset Password Verification Code",
      html: `<p>Your One-Time Password (OTP) is: <strong>${otp}</strong></p>
             <p>This OTP is required to verify your email address and ensure the security of your account. Please enter this code in the designated field on the verification page. For added security, this OTP is valid for a limited time only.</p>
             <p>If you did not request this verification, you can safely ignore this email.</p>
             <p>Best regards,<br>Trading Bot Team</p>`,
    };
    await sendMail(mailOptions);
    const token = user.getToken();
    console.log("token : ", token);
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

export const resetPassword = async (req, res) => {
  console.log("--------");
  console.log("Reset password api called ");
  console.log("--------");

  const { access_token, oldPassword, newPassword } = req.body;
  // sanity check
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

    let user = await UserModel.findById({ _id: decoded.id }).select(
      "+password"
    );
    if (!user) {
      console.log("User not registered");
      return res.status(400).json({
        status: false,
        message: "User not registered",
      });
    }
    if (!user.isVerified) {
      console.log(
        "Your account is not verified. Please sign up again to complete the verification process"
      );
      return res.status(400).json({
        status: false,
        message:
          "Your account is not verified. Please sign up again to complete the verification process",
      });
    }
    if (!user.isActive) {
      console.log("User not Active");
      return res.status(400).json({
        status: false,
        message: "Account deleted",
      });
    }

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

export const resendOtp = async (req, res) => {
  console.log("------");
  console.log("resendOTP api called ");
  console.log("------");
  // screenType can be  = login, forgotPassword, 2FA
  const { email, screenType } = req.body;
  // sanity check
  if (!(email && screenType)) {
    console.log("Invalid input");
    return res.status(400).json({
      status: false,
      message: `Please ensure that you are sending all the required fields ( email, screenType )`,
    });
  }
  try {
    const _email = email.toLowerCase();
    console.log("Email : ", _email);

    let user = await UserModel.findOne({ email: _email });

    if (!user) {
      console.log("Email not registered");
      return res.status(400).json({
        status: false,
        message: "Email not registered",
      });
    }
    if (screenType != "login") {
      if (!user.isVerified) {
        console.log(
          "Your account is not verified. Please sign up again to complete the verification process"
        );
        return res.status(400).json({
          status: false,
          message:
            "Your account is not verified. Please sign up again to complete the verification process",
        });
      }
      if (!user.isActive) {
        console.log("Email not Active");
        return res.status(400).json({
          status: false,
          message: "Account deleted",
        });
      }
    }
    console.log("user  : ", user);
    // ----------------------------------------------------------------
    // Generate an OTP
    const secret = speakeasy.generateSecret({
      length: 20,
    });
    let otp = speakeasy.totp({
      secret: secret.base32,
      encoding: "base32",
    });
    otp = otp.slice(0, 6);
    const otpExpiryTime = parseInt(process.env.OTP_EXPIRY_TIME);
    const currentTime = parseInt(new Date().getTime() / 1000);
    const otpExpiry = currentTime + otpExpiryTime;
    console.log("OTP Expiry Time: ", otpExpiry);
    console.log("Current Time: ", currentTime);
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user?.save();
    console.log("Otp saved in Database .");
    // ----------------------------------------------------------------
    let subject;
    if (screenType === "login") {
      subject = "Your Login Verification Code";
    }
    if (screenType === "2FA") {
      subject = "Your OTP for Two-Factor Authentication";
    }
    if (screenType === "forgotPassword") {
      subject = "Your Reset Password Verification Code";
    }
    let mailOptions = {
      from: process.env.SMTP_MAIL,
      to: user.email,
      subject: subject,
      html: `<p>Your One-Time Password (OTP) is: <strong>${otp}</strong></p>
             <p>This OTP is required to verify your email address and ensure the security of your account. Please enter this code in the designated field on the verification page. For added security, this OTP is valid for a limited time only.</p>
             <p>If you did not request this verification, you can safely ignore this email.</p>
             <p>Best regards,<br>Trading Bot Team</p>`,
    };
    await sendMail(mailOptions);

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
  console.log("--------");
  console.log("verify OTP api called");
  console.log("--------");
  // screenType can be  = login, forgotPassword, 2FA
  const { email, otp, screenType } = req.body;
  // sanity check
  if (!(email && otp && screenType)) {
    return res.status(400).json({
      status: false,
      message:
        "Please ensure you are sending all the required fields in the request body ( email, otp, screenType)",
    });
  }

  let _email;
  _email = email.toLowerCase();
  console.log("Email : ", _email);
  let user = await UserModel.findOne({ email: _email });
  console.log("User : ", user);
  try {
    if (!user) {
      console.log("Email not registered");
      return res.status(400).json({
        status: false,
        message: "Email not registered",
      });
    }
    if (screenType != "login") {
      if (!user.isVerified) {
        console.log(
          "Your account is not verified. Please sign up again to complete the verification process"
        );
        return res.status(400).json({
          status: false,
          message:
            "Your account is not verified. Please sign up again to complete the verification process",
        });
      }

      if (!user.isActive) {
        console.log("User not Active");
        return res.status(400).json({
          status: false,
          message: "Account deleted",
        });
      }
    }
    // ----------------------------------------------------------------
    if (user.otp != otp) {
      return res.status(400).json({
        status: false,
        message: "Invalid OTP",
      });
    }
    if (user.otp == otp) {
      let currentTime = parseInt(new Date().getTime() / 1000);
      console.log(
        "Expiry time : ",
        user.otpExpiry,
        "Current time : ",
        currentTime
      );
      if (user.otpExpiry < currentTime) {
        console.log("Error : OTP Expired ");
        return res.status(400).json({
          status: false,
          message: "OTP is Expired",
        });
      }
    }
    user.otp = "";
    user.otpExpiry = "";
    if (screenType == "login") user.isVerified = true;
    await user?.save();

    if (screenType == "2FA") {
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
    }

    return res.status(200).json({
      success: true,
      msg: "OTP verified successfully",
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

export const updatePassword = async (req, res) => {
  console.log("--------");
  console.log("Update password api called ");
  console.log("--------");

  const { oldPassword, newPassword } = req.body;
  // sanity check
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

export const onOFF2Factor = async (req, res) => {
  console.log("--------");
  console.log("Enable or disable Two-Factor Authentication api called ");
  console.log("--------");

  const { type } = req.body;
  // sanity check
  if (!type) {
    console.log("Invalid Input");
    return res.status(400).json({
      status: false,
      message: `Please ensure that you have send all the required fields ( type )`,
    });
  }
  try {
    let user = await UserModel.findOne({ email: req.user.email });
    if (type == "true") {
      user.is2Factor = true;
    } else {
      user.is2Factor = false;
    }
    await user.save();
    return res.status(200).json({
      status: true,
      message: "2FA updated successfully",
      user,
    });
  } catch (error) {
    console.log("Error : ", error);
    return res.status(500).json({
      status: false,
      msg: "Internal server error",
    });
  }
};

export const updateProfile = async (req, res) => {
  console.log("--------");
  console.log("Update profile api called ");
  console.log("--------");
};
