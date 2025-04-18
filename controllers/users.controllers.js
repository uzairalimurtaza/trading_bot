import UserModel from "../models/user.model.js";
import jwt from "jsonwebtoken";

// Get user profile using token
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await UserModel.findById(userId).select("name email phoneNo subscribedPlan planStartDate planEndDate walletKey");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Update user profile with validations
export const updateUserProfile = async (req, res) => {
  const { name, phoneNo } = req.body;
  const userId = req.user.id;

  try {
    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Check if the user is trying to change their name
    if (name && name !== user.name) {
      const existingName = await UserModel.findOne({ name });
      if (existingName) {
        return res.status(400).json({ message: "Username already in use" });
      }
      user.name = name;
    }

    if (phoneNo) user.phoneNo = phoneNo;

    await user.save();

    // res.status(200).json({ message: "Profile updated successfully", user });
    res.status(200).json({
        success: true,
        message: "User profile updated successfully",
        user: {
          name: user.name,
          phoneNo: user.phoneNo,
        }
      });
  } catch (err) {
    res.status(500).json({ message: "Update failed", error: err.message });
  }
};
