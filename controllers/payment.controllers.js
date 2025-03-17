import {
  getConfirmation,
  parseTransaction,
} from "../services/blockchain/transactions.js";
import Transaction from "../models/transaction.model.js";

import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";

const connection = new Connection(process.env.RPC_URL, "confirmed");

export const confirmTransaction = async (req, res) => {
  const { txHash } = req.body;
  if (!txHash) {
    console.log("Invalid Input");
    return res.status(400).json({
      status: false,
      message:
        "Please ensure that you have send all the required fields ( txHash )",
    });
  }
  try {
    let hashFound = await Transaction.findOne({ txHash: txHash });
    if (hashFound) {
      console.log("Transaction with this hash already exists .");
      return res.status(400).json({
        status: false,
        message: "Transaction with this hash already exists .",
      });
    }
    const result = await getConfirmation(connection, txHash);
    if (!result) {
      console.log("FAILED TRANSACTION ...");
      return res.status(400).json({
        status: false,
        message: "Failed transaction .",
      });
    }
    const { success, from, to, amount } = await parseTransaction(txHash);
    if (!success) {
      console.log("Error fetching transaction.");
      return res.status(400).json({
        status: false,
        message: "Error fetching transaction.",
      });
    }
    if (to != process.env.FUNDS_HOLDER_ACCOUNT) {
      console.log("Invalid transaction");
      return res.status(400).json({
        status: false,
        message: "Invalid transaction",
      });
    }

    const txRecord = new Transaction({
      userId: req.user._id,
      fromAddress: from,
      amount: amount / LAMPORTS_PER_SOL,
      toAddress: to,
      txHash: txHash,
    });

    await txRecord.save();

    return res.status(200).json({
      status: true,
      message: "Transaction confirmed successfully.",
    });
  } catch (error) {
    console.log("Error : ", error);
    return res.status(500).json({
      status: false,
      message: error,
    });
  }
};
