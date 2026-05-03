const { Router } = require("express");
const { login, register, changePassword } = require("../controllers/auth.controller");
const { requireAuth } = require("../middleware/auth.middleware");

const authRouter = Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.post("/change-password", requireAuth, changePassword);

module.exports = authRouter;
