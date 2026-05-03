const { Router } = require("express");
const { requireAuth, requireRole } = require("../middleware/auth.middleware");
const {
  createLibrarianCode,
  listUsers,
  getUser,
  updateUser,
  setUserPassword,
  deleteUser
} = require("../controllers/user.controller");

const userRouter = Router();

userRouter.use(requireAuth);
userRouter.use(requireRole(["ADMIN"]));

userRouter.get("/", listUsers);
userRouter.post("/librarian-codes", createLibrarianCode);
userRouter.get("/:id", getUser);
userRouter.patch("/:id", updateUser);
userRouter.patch("/:id/password", setUserPassword);
userRouter.delete("/:id", deleteUser);

module.exports = userRouter;
