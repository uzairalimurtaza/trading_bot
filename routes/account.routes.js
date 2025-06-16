import express from "express";

import {
  createAccount,
  deleteAccount,
  addCredentials,
  deleteCredentials,
  getAccountSummary,
  getAccountCredentials,
  getUserAccounts,
  getAvailableConnectors,
  getConnectorsConfigMap,
} from "../controllers/account.controllers.js";
import { auth } from "../middlewares/auth.js";

const router = express.Router();

router.post("/add-account/:accountName", auth, createAccount);
router.post("/delete-account/:accountName", auth, deleteAccount);
router.post(
  "/add-credentials/:accountName/:connectorName",
  auth,
  addCredentials
);
router.post(
  "/delete-credentials/:accountName/:connectorName",
  auth,
  deleteCredentials
);
router.get("/list-accounts", auth, getUserAccounts);
router.get("/list-credentials/:accountName", auth, getAccountCredentials);
router.get("/available-connectors", auth, getAvailableConnectors);
router.get("/connectors-config-map", auth, getConnectorsConfigMap);
router.get("/summary", auth, getAccountSummary);

export default router;
