import mongoose from "mongoose";
import CredentialsModel from "./credentials.model.js";

const AccountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    accountName: {
      type: String,
      required: true,
    },
    uniqueAccountName: {
      type: String,
      required: true,
      unique: true,
    },
  },
  { timestamps: true }
);
AccountSchema.index({ userId: 1, accountName: 1 }, { unique: true });
AccountSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    try {
      await CredentialsModel.deleteMany({ accountId: doc._id });
      console.log(`Credentials deleted for account ${doc._id}`);
    } catch (err) {
      console.error("Error deleting credentials:", err);
    }
  }
});

const AccountModel = mongoose.model("Account", AccountSchema);
export default AccountModel;
