import { Router } from "express";
import { Signin, Signup } from "../controllers/user.controllers.js";
import { validateSchema } from "../middlewares/schemaValidation.middleware.js";
import loginSchema from "../models/login.model.js";
import userSchema from "../models/user.model.js";

const router = Router();

router.post("/sign-up", validateSchema(userSchema), Signup);
router.post("/sign-in", validateSchema(loginSchema), Signin);

export default router;
