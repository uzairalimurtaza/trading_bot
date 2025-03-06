import mongoose from "mongoose";

export async function connectToDataBase() {
  mongoose
    .connect(process.env.DATABASE_CREDENTIALS)

    .then(() => {
      console.log("Trading Bot server connected to MongoDB successfully");
    })
    .catch((err) => {
      console.log("ERRR! Connection to MongoDB Failed");
      console.log(err);
    });
}
