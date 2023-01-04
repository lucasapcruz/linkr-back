import { Router } from "express";
import { createPost, deletePost, getPosts, updatePost } from "../controllers/posts.controllers.js";
import { validateSchema } from "../middlewares/schemaValidation.middleware.js";
import { tokenValidation } from "../middlewares/token.middleware.js";
import { postSchema } from "../models/posts.model.js";

const router = Router();

router.post("/posts", tokenValidation, validateSchema(postSchema), createPost);
router.get("/posts", tokenValidation, getPosts);
router.patch("/posts", tokenValidation, updatePost);
router.delete("/posts/:id", tokenValidation, deletePost);

export default router;
