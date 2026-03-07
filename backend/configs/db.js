import mongoose from "mongoose";

let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    console.log("Using existing MongoDB connection");
    return;
  }

  try {
    mongoose.connection.on("connected", () => console.log("MONGODB Connected"));
    await mongoose.connect(`${process.env.MONGODB_URI}`, {
      serverSelectionTimeoutMS: 30000,
      bufferCommands: false,
    });
    isConnected = mongoose.connection.readyState === 1;
  } catch (error) {
    console.log(error.message);
    throw error;
  }
};

export default connectDB;
