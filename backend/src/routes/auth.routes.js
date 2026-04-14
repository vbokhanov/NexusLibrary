const { Router } = require("express");
const { login, register } = require("../controllers/auth.controller");

const authRouter = Router();

authRouter.post("/register", register);
authRouter.post("/login", login);

module.exports = authRouter;
