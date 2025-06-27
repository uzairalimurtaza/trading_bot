import express from "express";

import {
  addPMMSimpleConfig,
  getUserStrategyFileNames,
  getUserStrategies,
  deleteStorageFiles,
  launchBot,
} from "../controllers/strategy.controllers.js";
import { auth } from "../middlewares/auth.js";

const router = express.Router();

router.post("/add-controller-config", auth, addPMMSimpleConfig);
router.get("/get-user-strategy-filenames", auth, getUserStrategyFileNames);
router.get("/get-user-strategies", auth, getUserStrategies);
router.post("/delete-strategies", auth, deleteStorageFiles);
router.post("/launch-bot", auth, launchBot);
export default router;
