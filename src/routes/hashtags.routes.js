import { Router } from "express";
import { getTrendingHashtags } from "../controllers/hashtags.controllers.js";
import { tokenValidation } from "../middlewares/token.middleware.js";

const router = Router();

router.get("/hashtags", tokenValidation, getTrendingHashtags);

export default router;
