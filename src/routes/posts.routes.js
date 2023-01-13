import { Router } from "express";
import {
  createPost,
  deletePost,
  getPosts,
  updatePost,
  likePost,
  getPostLikes,
  postComment,
  getComment,
  repost,
} from "../controllers/posts.controllers.js";
import { validateSchema } from "../middlewares/schemaValidation.middleware.js";
import { tokenValidation } from "../middlewares/token.middleware.js";
import commentSchema from "../models/comments.model.js";
import { postSchema } from "../models/posts.model.js";

const router = Router();

router.post("/posts", tokenValidation, validateSchema(postSchema), createPost);
router.get("/posts", tokenValidation, getPosts);
router.get("/posts/user/:id", tokenValidation, getPosts);
router.patch("/posts", tokenValidation, updatePost);
router.delete("/posts/:id", tokenValidation, deletePost);
router.post("/likes", tokenValidation, likePost);
router.get("/likes", getPostLikes);
router.post("/comments", tokenValidation, validateSchema(commentSchema), postComment);
router.get("/comments", getComment);
router.get("/comments/:postId", getComment);
router.post("/share/:id", tokenValidation, repost);

export default router;
