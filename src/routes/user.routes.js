import { Router } from "express";
import { find, Signin, Signup } from "../controllers/user.controllers.js";
import { validateSchema } from "../middlewares/schemaValidation.middleware.js";
import { tokenValidation } from "../middlewares/token.middleware.js";
import loginSchema from "../models/login.model.js";
import userSchema from "../models/user.model.js";

const router = Router();

router.post("/sign-up", validateSchema(userSchema), Signup);
router.post("/sign-in", validateSchema(loginSchema), Signin);
router.get("/user/:id", tokenValidation, find);

export default router;
