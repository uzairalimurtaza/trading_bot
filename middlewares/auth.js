import jwt from "jsonwebtoken";
import UserModel from "../models/user.model.js";

export const auth = async (req, res, next) => {
  let token;
  if (req.headers.authorization) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    const error = new Error("Not Authorized");
    error.statusCode = 401;
    return next(error);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserModel.findById(decoded.id);

    if (!user) {
      const error = new Error("User not found");
      error.statusCode = 401;
      return next(error);
    }

    if (!user.isActive) {
      const error = new Error("User deactivated");
      error.statusCode = 401;
      return next(error);
    }
    if (!user.isVerified) {
      const error = new Error("User not verified");
      error.statusCode = 401;
      return next(error);
    }

    req.user = user;
    next();
  } catch (err) {
    const error = new Error("Not Authorized");
    error.statusCode = 401;
    return next(error);
  }
};
