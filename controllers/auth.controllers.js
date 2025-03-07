import UserModel from "../models/user.model.js";
import { sendMail } from "../utils/mailService.js";

import bcrypt from "bcrypt";
import speakeasy from "speakeasy";

export const signUpUser = async (req, res) => {
  console.log("--------");
  console.log("Signup user api called ");
  console.log("--------");
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
    console.log("User : ", user);

    // otp generation
    const secret = speakeasy.generateSecret({
      length: 20,
    });
    let otp = speakeasy.totp({
      secret: secret.base32,
      encoding: "base32",
    });
    //

    // get only first 4 digits of otp generated above
    otp = otp.slice(0, 4);
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
      subject: "Your Login Verification Code",
      text: `Your One-Time Verification Code: ${otp}. Use it to securely access your account.`,
    };
    //
    await sendMail(mailOptions);

    return res.status(200).json({
      status: true,
      message: "Email send for verification",
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

  const { email, otp, screen } = req.body;
  // sanity check
  if (!(email && otp && screen)) {
    return res.status(400).json({
      status: false,
      message:
        "Please ensure you are sending all the required fields in the request body ( email, otp, screen)",
    });
  }

  let _email;
  _email = email.toLowerCase();
  console.log("Email : ", _email);
  let user = await UserModel.findOne({ email: _email });
  console.log("User : ", user);
  try {
    // let token = await user.getToken();
    if (!user) {
      console.log("Email not registered");
      return res.status(400).json({
        status: false,
        message: "Email not registered",
      });
    }
    if (user && screen === "forgetPassword") {
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
    //
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
    user.isVerified = true;
    await user?.save();

    return res.status(200).json({
      success: true,
      msg: "OTP verified successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      msg: "Email verification error ",
      error,
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
    let result = await user.comparePassword(password);
    console.log(result);
    if (!result) {
      console.log("Invalid password");
      return res.status(400).json({
        status: false,
        message: "Invalid password",
      });
    }
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
      ...user._doc,
    });
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
    // get only first 4 digits of otp generated above
    otp = otp.slice(0, 4);
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
      text: `Your One-Time Verification Code: ${otp}. Use it to securely access your account.`,
    };
    await sendMail(mailOptions);
    return res.status(200).json({
      status: true,
      message: "Email send for password reset",
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
  const { email, oldPassword, newPassword } = req.body;
  if (!(email && oldPassword && newPassword)) {
    console.log("Invalid Input");
    return res.status(400).json({
      status: false,
      message:
        "Please ensure that you have send all the required fields ( email, oldPassword, newPassword )",
    });
  }
  try {
    const _email = email.toLowerCase();
    console.log("user email : ", _email);
    console.log("1", req.body);
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
    console.log("2");
    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({
        status: false,
        message: "Incorrect Password",
      });
    }
    console.log("3");
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
