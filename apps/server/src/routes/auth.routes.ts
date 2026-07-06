import { Router } from "express";
import { loginWithGoogle } from "../controllers/auth.controller.js";

const authRoutes = Router();

authRoutes.post("/login", loginWithGoogle);

export default authRoutes;
