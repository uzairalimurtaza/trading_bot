import axios from "axios";
import mongoose from "mongoose";

import CredentialsModel from "../models/credentials.model.js";
import AccountModel from "../models/account.model.js";

export const createAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountName = req.params.accountName;
    const uniqueAccountName = `${accountName}-${userId}`;

    await axios.post(
      `${process.env.HUMMING_BOT_API_BASE_URL}/add-account`,
      null,
      {
        params: { account_name: uniqueAccountName },
        auth: {
          username: process.env.HUMMING_BOT_USERNAME,
          password: process.env.HUMMING_BOT_PASSWORD,
        },
      }
    );
    console.log("Account created in Hummingbot .");

    const account = new AccountModel({
      userId,
      accountName,
      uniqueAccountName,
    });
    await account.save();
    console.log("Account saved in database.");

    return res.status(200).json({
      success: true,
      message: "Account created successfully.",
    });
  } catch (error) {
    const errMessage =
      error.response?.data?.detail || error.message || "Hummingbot error";
    const statusCode = error.response?.status || 500;

    console.error("Create Account Error:", errMessage);

    return res.status(statusCode).json({
      success: false,
      message: errMessage,
    });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountName = req.params.accountName;

    const account = await AccountModel.findOne({ userId, accountName });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    try {
      await axios.post(
        `${process.env.HUMMING_BOT_API_BASE_URL}/delete-account`,
        null,
        {
          params: { account_name: account.uniqueAccountName },
          auth: {
            username: process.env.HUMMING_BOT_USERNAME,
            password: process.env.HUMMING_BOT_PASSWORD,
          },
        }
      );
    } catch (error) {
      const err =
        error.response?.data?.detail || "Failed to delete account from bot";
      const status = error.response?.status || 500;
      return res.status(status).json({
        success: false,
        message: err,
      });
    }
    await AccountModel.findOneAndDelete({ userId, accountName });
    return res.status(200).json({
      success: true,
      message: "Account and associated credentials deleted successfully",
    });
  } catch (err) {
    console.error("Error in deleteAccount : ", err);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

export const addCredentials = async (req, res) => {
  const { accountName, connectorName } = req.params;
  const credentials = req.body;
  const userId = req.user.id;
  try {
    const account = await AccountModel.findOne({ userId, accountName });
    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found.",
      });
    }

    try {
      await axios.post(
        `${process.env.HUMMING_BOT_API_BASE_URL}/add-connector-keys/${account.uniqueAccountName}/${connectorName}`,
        credentials,
        {
          auth: {
            username: process.env.HUMMING_BOT_USERNAME,
            password: process.env.HUMMING_BOT_PASSWORD,
          },
        }
      );
    } catch (error) {
      console.log("error : ", error);
      const err =
        error.response?.data?.detail || "Failed to add connector keys";
      const status = error.response?.status || 500;
      return res.status(status).json({
        success: false,
        message: err,
      });
    }
    const fileName = `${connectorName}.yml`;
    const existingCredential = await CredentialsModel.findOne({
      accountId: account._id,
      connectorName,
    });

    if (existingCredential) {
      existingCredential.fileName = fileName;
      await existingCredential.save();
    } else {
      await CredentialsModel.create({
        accountId: account._id,
        connectorName,
        fileName,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Credentials added successfully.",
    });
  } catch (err) {
    console.error("Error adding credentials:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

export const deleteCredentials = async (req, res) => {
  const { accountName, connectorName } = req.params;
  const userId = req.user.id;

  try {
    const account = await AccountModel.findOne({ userId, accountName });
    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found.",
      });
    }
    const credential = await CredentialsModel.findOne({
      accountId: account._id,
      connectorName,
    });

    if (!credential) {
      return res.status(404).json({
        success: false,
        message: "Credential not found.",
      });
    }
    try {
      await axios.post(
        `${process.env.HUMMING_BOT_API_BASE_URL}/delete-credential/${account.uniqueAccountName}/${connectorName}`,
        null,
        {
          auth: {
            username: process.env.HUMMING_BOT_USERNAME,
            password: process.env.HUMMING_BOT_PASSWORD,
          },
        }
      );
    } catch (error) {
      const err =
        error.response?.data?.detail ||
        "Failed to delete connector keys from Hummingbot.";
      const status = error.response?.status || 500;
      return res.status(status).json({
        success: false,
        message: err,
      });
    }

    await credential.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Credentials deleted successfully.",
    });
  } catch (err) {
    console.error("Delete Credentials Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
};

export const getUserAccounts = async (req, res) => {
  try {
    const userId = req.user.id;
    const accounts = await AccountModel.find({ userId }).select("accountName");

    const accountNames = accounts.map((acc) => acc.accountName);

    return res.status(200).json({
      success: true,
      Accounts: accountNames,
    });
  } catch (error) {
    console.error("Error fetching accounts : ", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch accounts.",
    });
  }
};

export const getAccountCredentials = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountName = req.params.accountName;

    const account = await AccountModel.findOne({ userId, accountName });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    const credential = await CredentialsModel.find({
      accountId: account._id,
    }).select("connectorName");
    const credentials = credential.map((acc) => acc.connectorName);
    return res.status(200).json({
      success: true,
      credentials,
    });
  } catch (error) {
    console.error("Error fetching credentials : ", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch credentials.",
    });
  }
};

export const getAvailableConnectors = async (req, res) => {
  try {
    const response = await axios.get(
      `${process.env.HUMMING_BOT_API_BASE_URL}/available-connectors`,
      {
        headers: {
          accept: "application/json",
        },
        auth: {
          username: process.env.HUMMING_BOT_USERNAME,
          password: process.env.HUMMING_BOT_PASSWORD,
        },
      }
    );
    const connectors = response.data;

    return res.status(200).json({
      success: true,
      connectors,
    });
  } catch (error) {
    console.error("Error fetching connectors : ", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch available connectors",
    });
  }
};

export const getConnectorsConfigMap = async (req, res) => {
  try {
    const response = await axios.get(
      `${process.env.HUMMING_BOT_API_BASE_URL}/all-connectors-config-map`,
      {
        headers: {
          accept: "application/json",
        },
        auth: {
          username: process.env.HUMMING_BOT_USERNAME,
          password: process.env.HUMMING_BOT_PASSWORD,
        },
      }
    );
    const configMap = response.data;

    return res.status(200).json({
      success: true,
      configMap,
    });
  } catch (error) {
    console.error("Error fetching connector config map : ", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch connectors config map",
    });
  }
};

export const getAccountSummary = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await AccountModel.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: "credentials",
          localField: "_id",
          foreignField: "accountId",
          as: "credentials",
        },
      },
      {
        $project: {
          accountName: 1,
          connectorNames: {
            $map: {
              input: "$credentials",
              as: "cred",
              in: "$$cred.connectorName",
            },
          },
        },
      },
    ]);

    const summary = {};
    for (const acc of result) {
      summary[acc.accountName] = acc.connectorNames;
    }

    return res.status(200).json({
      status: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error in getAccountSummary : ", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error",
    });
  }
};
