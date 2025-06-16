import mongoose from "mongoose";
const CredentialSchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    connectorName: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true, // "mexc.yml", "binance.yml"
    },
  },
  { timestamps: true }
);

CredentialSchema.index({ accountId: 1, connectorName: 1 }, { unique: true });

const CredentialsModel = mongoose.model("Credential", CredentialSchema);
export default CredentialsModel;
