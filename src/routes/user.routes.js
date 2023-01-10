import { Router } from "express";
import {
  deleteUser,
  find,
  findAll,
  followUser,
  Signin,
  Signup,
} from "../controllers/user.controllers.js";
import { validateSchema } from "../middlewares/schemaValidation.middleware.js";
import { tokenValidation } from "../middlewares/token.middleware.js";
import loginSchema from "../models/login.model.js";
import userSchema from "../models/user.model.js";

const router = Router();

router.post("/sign-up", validateSchema(userSchema), Signup);
router.post("/sign-in", validateSchema(loginSchema), Signin);
router.get("/user/:id", tokenValidation, find);
router.get("/user", tokenValidation, findAll);
router.delete("/users", tokenValidation, deleteUser);
router.post("/follow/:id", tokenValidation, followUser);

export default router;
