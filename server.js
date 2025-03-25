import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import router from "./routes/index.js";
import { connectToDataBase } from "./config/dbConfig.js";

mongoose.set("strictQuery", true);
dotenv.config({ path: "./.env" });

const app = express();

app.post("/api/stripe/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(bodyParser.json({ limit: "100mb" }));
app.use(bodyParser.urlencoded({ limit: "100mb", extended: true }));
// CORS setup
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
// CORS SETUP
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});



// routes
app.use("/api", router);
app.use("/", (req, res) => res.send("Welcome to Trading Bot"));
// ________________________
// MONGODB CONNECTION
try {
  await connectToDataBase();
} catch {
  console.log("Error connecting database");
}

// SERVER LISTENING
const PORT = process.env.PORT || 4005;
app.listen(PORT, () => {
  console.log("Trading Bot server is running successfully on Port: " + PORT);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
