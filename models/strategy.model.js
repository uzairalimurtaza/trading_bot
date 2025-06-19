import mongoose from "mongoose";

const strategySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    strategyFileName: {
      type: String,
      required: true,
    },
    strategyFileUniqueName: {
      type: String,
      required: true,
      unique: true,
    },
    controllerName: {
      type: String,
      required: true,
    },
    controllerType: {
      type: String,
      required: true,
    },
    config: {
      type: Object,
      required: true,
    },
  },
  { timestamps: true }
);

const StrategyModel = mongoose.model("Strategy", strategySchema);
export default StrategyModel;
