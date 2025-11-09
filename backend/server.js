import express from "express";
import cors from "cors";
import "dotenv/config";
import connectDB from "./configs/db.js";

const app = express();

await connectDB()

const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => res.send("Server is running"));
app.listen(PORT, () => console.log(`Server running on PORT: ${PORT}`));
