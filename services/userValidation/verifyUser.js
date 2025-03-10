import UserModel from "../../models/user.model.js";

export const validateUser = async (email, isLogin) => {
  try {
    const _email = email.toLowerCase();
    const user = await UserModel.findOne({ email: _email });

    if (!user) {
      return { success: false, message: "Email not registered" };
    }
    if (!isLogin) {
      if (!user.isVerified) {
        return {
          success: false,
          message:
            "Your account is not verified. Please sign up again to complete the verification process",
        };
      }

      if (!user.isActive) {
        return { success: false, message: "Account deleted" };
      }
    }

    return { success: true, user };
  } catch (error) {
    console.error("Error in validateUser :", error);
    return { success: false, message: "Internal Server Error" };
  }
};
