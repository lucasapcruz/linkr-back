import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import postsRoutes from './routes/posts.routes.js';
import authRoutes from './routes/user.routes.js';
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(postsRoutes);
app.use(authRoutes)

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running in port ${PORT}`));
