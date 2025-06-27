import mongoose from "mongoose";

const instanceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    uniqueName: {
      type: String,
      required: true,
      unique: true,
    },
  },
  { timestamps: true }
);

instanceSchema.index({ userId: 1, name: 1 }, { unique: true });

const InstanceModel = mongoose.model("Instance", instanceSchema);
export default InstanceModel;
