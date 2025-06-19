import express from "express";

import { addPMMSimpleConfig } from "../controllers/strategy.controllers.js";
import { auth } from "../middlewares/auth.js";

const router = express.Router();

router.post("/add-controller-config", auth, addPMMSimpleConfig);

export default router;
