import express from "express";
import { auth } from "../middlewares/auth.js";
import { getUserProfile, updateUserProfile } from "../controllers/users.controllers.js";

const router = express.Router();

router.get("/profile", auth, getUserProfile);
router.put("/profile", auth, updateUserProfile);

export default router;