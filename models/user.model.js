import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

const User = new mongoose.Schema(
  {
    name: {
      type: String,
      required: false,
      default: "",
    },
    phoneNo: {
      type: String,
      required: false,
    },
    role: {
      type: String,
      enum: ["Admin", "User"],
      default: "User",
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    isVerified: {
      type: Boolean,
      required: false,
      default: false,
    },
    isActive: {
      type: Boolean,
      required: false,
      default: true,
    },
    pictureFilename: {
      type: String,
      required: false,
      default: null,
    },
    profilePicture: {
      type: String,
      required: false,
      default: null,
    },
    otp: {
      type: String,
      required: false,
    },
    otpExpiry: {
      type: Number,
      required: false,
    },
  },
  { timestamps: true }
);
User.methods.getToken = function () {
  return jwt.sign({ id: this._id, name: this.name }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};
// Method to Hash passwords before storing in database
User.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    return next(err);
  }
});
// Method to compare passwords
User.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const UserModel = mongoose.model("User", User);
export default UserModel;
