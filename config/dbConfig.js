import mongoose from "mongoose";

export async function connectToDataBase() {
  try {
    await mongoose.connect(process.env.DATABASE_CREDENTIALS);
    console.log("✅ Trading Bot server connected to MongoDB successfully");
  } catch (err) {
    console.error("❌ ERR! Connection to MongoDB Failed", err);
    throw err; // Ensure the error propagates
  }
}
